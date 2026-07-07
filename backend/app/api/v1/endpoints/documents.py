from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from typing import List
from app.core.mongodb import documents_col, workspaces_col, members_col, db
from app.services.document_service import extract_text_from_blob
from app.services.youtube_service import YouTubeService
from app.services.ai_service import summarize_youtube_video
from app.api.v1.dependencies import get_current_user
import uuid
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorGridFSBucket

router = APIRouter()
fs = AsyncIOMotorGridFSBucket(db)

async def verify_workspace_access(workspace_id: str, user_email: str):
    """Utility to check if a user belongs to a workspace"""
    ws = await workspaces_col.find_one({"id": workspace_id})
    if ws and ws.get("owner_email") == user_email:
        return {"role": "OWNER"}
        
    member = await members_col.find_one({
        "workspace_id": workspace_id,
        "user_email": user_email,
        "status": "ACCEPTED"
    })
    
    if member:
        return member
        
    raise HTTPException(status_code=403, detail="Access denied to this workspace")

ALLOWED_EXTENSIONS = {'.pdf', '.doc', '.docx', '.txt'}

@router.post("/upload")
async def upload_document(
    workspace_id: str = Form(...),
    file: UploadFile = File(...),
    user=Depends(get_current_user)
):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    await verify_workspace_access(workspace_id, user_email)

    # Validate file type
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Only PDF, DOC, DOCX, and TXT files are supported."
        )

    try:
        # 1. Read file content
        file_content = await file.read()
        file_id = str(uuid.uuid4())
        
        # 2. Upload to MongoDB GridFS
        grid_in = fs.open_upload_stream(
            file.filename,
            metadata={"workspace_id": workspace_id, "id": file_id, "content_type": file.content_type}
        )
        await grid_in.write(file_content)
        await grid_in.close()

        # 3. Extract text from blob
        extracted_text = await extract_text_from_blob(file_content, file.filename)

        # 4. Save metadata to database (simulating Supabase table)
        doc_data = {
            "id": file_id,
            "workspace_id": workspace_id,
            "name": file.filename,
            "file_url": f"/api/v1/documents/raw/{file_id}", # Route to download from GridFS
            "file_type": file.content_type,
            "file_size": len(file_content),
            "content_text": extracted_text[:10000],
            "created_at": datetime.utcnow()
        }
        
        await documents_col.insert_one(doc_data.copy())
        return doc_data
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{workspace_id}")
async def get_documents(workspace_id: str, user=Depends(get_current_user)):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    await verify_workspace_access(workspace_id, user_email)
        
    cursor = documents_col.find({"workspace_id": workspace_id}).sort("created_at", -1)
    docs = await cursor.to_list(length=100)
    for doc in docs:
        if "_id" in doc: doc["_id"] = str(doc["_id"])
    return docs

@router.get("/raw/{document_id}")
async def get_document_raw(document_id: str):
    """Specific route to download file from GridFS"""
    # In a real app, you'd add auth here too
    try:
        cursor = fs.find({"metadata.id": document_id})
        grid_out = await cursor.next()
        if not grid_out: raise HTTPException(status_code=404)
        
        from fastapi.responses import StreamingResponse
        return StreamingResponse(grid_out, media_type=grid_out.metadata.get("content_type"))
    except Exception as e:
        raise HTTPException(status_code=404, detail="File not found")

@router.delete("/{document_id}")
async def delete_document(document_id: str, user=Depends(get_current_user)):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    
    try:
        # 1. Get document info
        doc = await documents_col.find_one({"id": document_id})
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
            
        workspace_id = doc["workspace_id"]
        await verify_workspace_access(workspace_id, user_email)
        
        # 2. Delete from Database
        await documents_col.delete_one({"id": document_id})
        
        # 3. Delete from GridFS
        cursor = fs.find({"metadata.id": document_id})
        try:
            grid_out = await cursor.next()
            if grid_out:
                await fs.delete(grid_out._id)
        except Exception:
            pass # Ignore if file missing from storage
            
        return {"status": "success", "message": "Document deleted"}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/youtube")
async def process_youtube_document(
    workspace_id: str = Form(...),
    url: str = Form(...),
    user=Depends(get_current_user)
):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    await verify_workspace_access(workspace_id, user_email)

    # 1. Extract Video ID
    video_id = YouTubeService.extract_video_id(url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    # 2. Get Transcript
    transcript = await YouTubeService.get_transcript(video_id)
    if not transcript:
        raise HTTPException(status_code=400, detail="Could not retrieve transcript for this video. Use a video with captions!")

    # 3. AI Summarization
    summary_markdown = await summarize_youtube_video(transcript)
    
    # 4. Save as Virtual Document
    doc_id = str(uuid.uuid4())
    doc_data = {
        "id": doc_id,
        "workspace_id": workspace_id,
        "name": f"YouTube Summary: {video_id}",
        "file_url": f"https://www.youtube.com/watch?v={video_id}",
        "file_type": "text/markdown",
        "file_size": len(summary_markdown),
        "content_text": summary_markdown,
        "is_virtual": True,
        "created_at": datetime.utcnow()
    }

    await documents_col.insert_one(doc_data.copy())
    return doc_data
