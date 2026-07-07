import re
from fastapi import APIRouter, Depends, HTTPException
from app.api.v1.dependencies import get_current_user
from app.services.ai_service import generate_podcast_script
from app.services.podcast_service import synthesize_podcast, clean_for_script_generation
from datetime import datetime
from app.core.mongodb import documents_col, chat_messages_col, workspaces_col
from app.api.v1.endpoints.chat import verify_workspace_access

router = APIRouter()

def strip_to_content(text: str) -> str:
    """Light cleaning - keep content, remove UI noise."""
    if not text:
        return ""
    t = text
    # Remove thinking/details blocks
    t = re.sub(r'<details>[\s\S]*?</details>', '', t)
    t = re.sub(r'<think>[\s\S]*?</think>', '', t)
    # Remove code blocks entirely (they don't help podcast)
    t = re.sub(r'```[\s\S]*?```', '', t)
    # Remove JSON diagram blocks
    t = re.sub(r'```json-diagram[\s\S]*?```', '', t)
    # Remove source citations like [1†L1-L3]
    t = re.sub(r'\[\d+[†L][^\]]*\]', '', t)
    # Remove "Sources:" section at the end
    t = re.sub(r'(?i)\n\*?Sources?:[\s\S]*$', '', t)
    # Remove emoji prefixes from headers
    t = re.sub(r'[📚🌐🎨💻✅💡❓🎯💭📐🤖🛠📝🔄🧠]\s*', '', t)
    # Remove markdown header markers but keep text
    t = re.sub(r'^#{1,6}\s*', '', t, flags=re.MULTILINE)
    # Remove bold/italic markers but keep text
    t = re.sub(r'\*{1,2}([^*]+)\*{1,2}', r'\1', t)
    # Remove table formatting but keep content
    t = re.sub(r'\|', ' ', t)
    t = re.sub(r'^[-*_]{3,}\s*$', '', t, flags=re.MULTILINE)
    # Clean up whitespace
    t = re.sub(r'\n{3,}', '\n\n', t)
    t = re.sub(r' {2,}', ' ', t)
    return t.strip()

@router.post("/workspaces/{workspace_id}/podcast")
async def create_podcast(workspace_id: str, payload: dict = None, user=Depends(get_current_user)):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    await verify_workspace_access(workspace_id, user_email)

    message_ids = payload.get("message_ids") if payload else None

    # Build context as clean Q&A pairs
    topics = []
    
    if message_ids:
        # SELECTIVE: User picked specific messages - build topic list
        cursor = chat_messages_col.find({
            "workspace_id": workspace_id,
            "id": {"$in": message_ids}
        })
        ai_messages = await cursor.to_list(length=50)
        ai_messages.sort(key=lambda x: x.get("created_at", 0))
        
        for ai_msg in ai_messages:
            # Find the user message before this AI response
            user_msg_cursor = chat_messages_col.find({
                "workspace_id": workspace_id,
                "sender_type": "user",
                "created_at": {"$lt": ai_msg.get("created_at", datetime.utcnow())}
            }).sort("created_at", -1).limit(1)
            user_msgs = await user_msg_cursor.to_list(length=1)
            
            question = ""
            if user_msgs:
                question = strip_to_content(user_msgs[0].get("content", ""))[:200]
            
            answer = strip_to_content(ai_msg.get("content", ""))
            
            if question and answer and len(answer) > 20:
                topics.append({"question": question, "answer": answer[:2000]})
        
        # Also add document content for context
        doc_cursor = documents_col.find({"workspace_id": workspace_id})
        docs = await doc_cursor.to_list(length=3)
        for doc in docs:
            if doc.get("content_text"):
                doc_text = strip_to_content(doc['content_text'][:3000])
                if doc_text:
                    topics.append({"question": f"Study material: {doc['name']}", "answer": doc_text})
    else:
        # NON-SELECTIVE: last few messages
        cursor = chat_messages_col.find({"workspace_id": workspace_id}).sort("created_at", -1).limit(10)
        recent = await cursor.to_list(length=10)
        recent.reverse()
        current_question = ""
        for msg in recent:
            if msg.get("sender_type") == "user":
                current_question = strip_to_content(msg.get("content", ""))[:200]
            elif current_question:
                answer = strip_to_content(msg.get("content", ""))
                if answer and len(answer) > 20:
                    topics.append({"question": current_question, "answer": answer[:2000]})
                current_question = ""

    if not topics:
        raise HTTPException(status_code=400, detail="Not enough content to generate a podcast. Chat with the AI Tutor first!")

    # Format context for the LLM - just raw content, no labels
    context = ""
    for i, t in enumerate(topics, 1):
        context += f"{t['question']}\n{t['answer']}\n\n"

    # 2. Generate Script
    script = await generate_podcast_script(context)
    if not script:
        raise HTTPException(status_code=500, detail="Failed to generate podcast script.")
    
    # 3. If script too short, retry with stronger instruction
    if len(script) < 20:
        retry = await generate_podcast_script(
            context + "\n\nThe previous attempt was too short. You MUST write at least 30 exchanges (60 lines). "
            "Cover EVERY topic in the content above. Each line should be 15-40 words.",
            _depth=1
        )
        if retry and len(retry) > len(script):
            script = retry

    # 4. Synthesize Audio via Edge-TTS & Pydub
    filename = await synthesize_podcast(script)
    if not filename:
        raise HTTPException(status_code=500, detail="Failed to synthesize audio. Check backend logs.")

    audio_url = f"/static/podcasts/{filename}"

    # 5. Persist to Workspace List
    now = datetime.utcnow()
    title = f"Study Session - {now.strftime('%d %b %H:%M')}"
    if message_ids:
        title = f"Deep Dive ({len(message_ids)} topics) - {now.strftime('%d %b %H:%M')}"
    podcast_entry = {
        "id": filename.split('.')[0],
        "url": audio_url,
        "title": title,
        "created_at": now
    }

    await workspaces_col.update_one(
        {"id": workspace_id},
        {"$push": {"podcasts": podcast_entry}}
    )

    return {
        "success": True,
        "podcast": podcast_entry
    }

@router.delete("/workspaces/{workspace_id}/podcasts/{podcast_id}")
async def delete_podcast(workspace_id: str, podcast_id: str, user=Depends(get_current_user)):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    await verify_workspace_access(workspace_id, user_email)
    
    # 1. Remove from MongoDB array
    await workspaces_col.update_one(
        {"id": workspace_id},
        {"$pull": {"podcasts": {"id": podcast_id}}}
    )
    
    # 2. Cleanup physical file if possible
    import os
    file_path = os.path.join("app/static/podcasts", f"{podcast_id}.mp3")
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except:
            pass # Ignore if file is busy
            
    return {"success": True}
@router.get("/active-model")
async def get_active_model():
    from app.services.ai_service import GROQ_MODEL
    display = GROQ_MODEL.split("/")[-1].replace("-instruct", "").replace("-", " ").title()
    return {"model_name": display, "raw_id": GROQ_MODEL}
