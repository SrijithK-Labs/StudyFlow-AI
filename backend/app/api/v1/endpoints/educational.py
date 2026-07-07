from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
import uuid
from datetime import datetime

from app.api.v1.dependencies import get_current_user
from app.api.v1.endpoints.chat import verify_workspace_access
from app.services.ai_service import generate_quiz, generate_flashcards
from app.core.mongodb import quizzes_col, flashcards_col, documents_col, chat_messages_col
from app.schemas.educational import Quiz, Flashcard, EducationalGenerationRequest

router = APIRouter()

@router.post("/workspaces/{workspace_id}/quiz/generate", response_model=Quiz)
async def create_quiz(workspace_id: str, request: EducationalGenerationRequest, user=Depends(get_current_user)):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    await verify_workspace_access(workspace_id, user_email)

    # Gather context
    context = ""
    if request.document_ids:
        cursor = documents_col.find({"workspace_id": workspace_id, "id": {"$in": request.document_ids}})
        docs = await cursor.to_list(length=10)
        for doc in docs:
            context += f"MATERIAL: {doc.get('content_text', '')[:2000]}\n\n"
    
    if not context:
        # Fallback to recent AI messages
        cursor = chat_messages_col.find({"workspace_id": workspace_id, "sender_type": "ai"}).sort("created_at", -1).limit(10)
        messages = await cursor.to_list(length=10)
        for m in reversed(messages):
            context += f"INFO: {m['content']}\n\n"

    if not context:
        raise HTTPException(status_code=400, detail="Not enough material to generate a quiz. Upload a document first!")

    quiz_data = await generate_quiz(context, count=request.count or 5)
    if not quiz_data:
        raise HTTPException(status_code=500, detail="Failed to generate quiz.")

    # Populate ID and metadata
    quiz_data["id"] = str(uuid.uuid4())
    quiz_data["workspace_id"] = workspace_id
    quiz_data["created_at"] = datetime.utcnow()

    # Ensure questions have IDs
    for q in quiz_data.get("questions", []):
        if "id" not in q:
            q["id"] = str(uuid.uuid4())

    # Save to DB
    await quizzes_col.insert_one(quiz_data.copy())
    if "_id" in quiz_data: del quiz_data["_id"]
    
    return quiz_data

@router.get("/workspaces/{workspace_id}/quizzes", response_model=List[Quiz])
async def get_quizzes(workspace_id: str, user=Depends(get_current_user)):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    await verify_workspace_access(workspace_id, user_email)
    
    cursor = quizzes_col.find({"workspace_id": workspace_id}).sort("created_at", -1)
    quizzes = await cursor.to_list(length=50)
    for q in quizzes:
        if "_id" in q: del q["_id"]
    return quizzes

@router.post("/workspaces/{workspace_id}/flashcards/generate", response_model=List[Flashcard])
async def create_flashcards(workspace_id: str, request: EducationalGenerationRequest, user=Depends(get_current_user)):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    await verify_workspace_access(workspace_id, user_email)

    # Gather context
    context = ""
    if request.document_ids:
        cursor = documents_col.find({"workspace_id": workspace_id, "id": {"$in": request.document_ids}})
        docs = await cursor.to_list(length=10)
        for doc in docs:
            context += f"MATERIAL: {doc.get('content_text', '')[:2000]}\n\n"
    
    if not context:
        cursor = chat_messages_col.find({"workspace_id": workspace_id, "sender_type": "ai"}).sort("created_at", -1).limit(10)
        messages = await cursor.to_list(length=10)
        for m in reversed(messages):
            context += f"INFO: {m['content']}\n\n"

    if not context:
        raise HTTPException(status_code=400, detail="Not enough material to generate flashcards.")

    cards_data = await generate_flashcards(context, count=request.count or 8)
    if not cards_data:
        raise HTTPException(status_code=500, detail="Failed to generate flashcards.")

    # Prepare and save cards
    final_cards = []
    for card in cards_data:
        card_doc = {
            "id": str(uuid.uuid4()),
            "workspace_id": workspace_id,
            "front": card["front"],
            "back": card["back"],
            "mastery_level": 0,
            "created_at": datetime.utcnow()
        }
        final_cards.append(card_doc)
    
    if final_cards:
        await flashcards_col.insert_many([c.copy() for c in final_cards])
    
    return final_cards

@router.get("/workspaces/{workspace_id}/flashcards", response_model=List[Flashcard])
async def get_flashcards(workspace_id: str, user=Depends(get_current_user)):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    await verify_workspace_access(workspace_id, user_email)
    
    cursor = flashcards_col.find({"workspace_id": workspace_id}).sort("created_at", -1)
    cards = await cursor.to_list(length=100)
    for c in cards:
        if "_id" in c: del c["_id"]
    return cards
