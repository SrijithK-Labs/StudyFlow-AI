from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List, Optional
from app.schemas.chat import Message, MemberMessage, MemberMessageCreate
from datetime import datetime
from pydantic import BaseModel
import uuid
from app.pipeline.orchestrator import pipeline

class MessageCreate(BaseModel):
    sender: str
    sender_type: str
    content: str
    request_audio: Optional[bool] = False

from app.core.mongodb import chat_messages_col, member_messages_col, workspaces_col, documents_col
from app.api.v1.dependencies import get_current_user

router = APIRouter()

async def verify_workspace_access(workspace_id: str, user_email: str):
    """Utility to check if a user belongs to a workspace and return their permissions"""
    # Check ownership in MongoDB
    ws = await workspaces_col.find_one({"id": workspace_id})
    if ws and ws.get("owner_email") == user_email:
        return {"role": "OWNER", "can_message_ai": True}
        
    # Check membership
    from app.core.mongodb import members_col
    member = await members_col.find_one({
        "workspace_id": workspace_id,
        "user_email": user_email,
        "status": "ACCEPTED"
    })
    
    if member:
        return member
        
    raise HTTPException(status_code=403, detail="Access denied to this workspace")

@router.get("/{workspace_id}/messages", response_model=List[Message])
async def get_chat_messages(workspace_id: str, user=Depends(get_current_user)):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    await verify_workspace_access(workspace_id, user_email)
    
    cursor = chat_messages_col.find({"workspace_id": workspace_id}).sort("created_at", 1)
    messages = await cursor.to_list(length=100)
    for msg in messages:
        if "_id" in msg: msg["_id"] = str(msg["_id"])
    return messages

@router.post("/{workspace_id}/messages", response_model=Message)
async def send_message(workspace_id: str, message: MessageCreate, user=Depends(get_current_user)):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    perms = await verify_workspace_access(workspace_id, user_email)
    
    if message.sender_type == 'user' and not perms.get("can_message_ai", True):
        raise HTTPException(status_code=403, detail="You do not have permission to send messages in this workspace")

    # Always use server-verified name, never trust frontend
    if isinstance(user, dict):
        user_name = user.get("full_name") or user.get("name") or "User"
    else:
        user_name = getattr(user, "full_name", None) or getattr(user, "name", "User")
    
    new_msg = {
        "id": str(uuid.uuid4()),
        "workspace_id": workspace_id,
        "sender": user_name,
        "sender_name": user_name,
        "sender_email": user_email,
        "sender_type": message.sender_type,
        "content": message.content,
        "created_at": datetime.utcnow()
    }
    
    await chat_messages_col.insert_one(new_msg.copy())
    
    # Real-time broadcast
    from app.core.socket_manager import notify_workspace_update
    import asyncio
    asyncio.create_task(notify_workspace_update(workspace_id, 'new_message', new_msg))
    
    return new_msg

@router.get("/{workspace_id}/member-messages", response_model=List[MemberMessage])
async def get_member_messages(workspace_id: str, user=Depends(get_current_user)):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    await verify_workspace_access(workspace_id, user_email)
        
    cursor = member_messages_col.find({"workspace_id": workspace_id}).sort("created_at", 1)
    messages = await cursor.to_list(length=100)
    for msg in messages:
        if "_id" in msg: msg["_id"] = str(msg["_id"])
    return messages

@router.post("/{workspace_id}/member-messages", response_model=MemberMessage)
async def send_member_message(workspace_id: str, message: MemberMessageCreate, user=Depends(get_current_user)):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    if isinstance(user, dict):
        user_name = user.get("full_name") or user.get("name") or "User"
    else:
        user_name = getattr(user, "full_name", None) or getattr(user, "name", "User")
    await verify_workspace_access(workspace_id, user_email)
    
    new_msg = {
        "id": str(uuid.uuid4()),
        "workspace_id": workspace_id,
        "sender_name": user_name,
        "sender_email": user_email,
        "content": message.content,
        "created_at": datetime.utcnow()
    }
    
    await member_messages_col.insert_one(new_msg.copy())
    
    # Real-time broadcast
    from app.core.socket_manager import notify_workspace_update
    import asyncio
    asyncio.create_task(notify_workspace_update(workspace_id, 'new_member_message', new_msg))
    
    return new_msg

@router.post("/{workspace_id}/ask", response_model=Message)
async def ask_ai(workspace_id: str, message: MessageCreate, user=Depends(get_current_user)):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    perms = await verify_workspace_access(workspace_id, user_email)
    
    if not perms.get("can_message_ai", True):
        raise HTTPException(status_code=403, detail="The owner has disabled AI messaging for your account")
    
    history = []
    # Fetch last 10 messages from MongoDB for context
    cursor = chat_messages_col.find({"workspace_id": workspace_id}).sort("created_at", -1).limit(10)
    hist_msgs = await cursor.to_list(length=10)
    
    # Exclude the current user message (saved in POST /messages just before /ask)
    if hist_msgs and hist_msgs[0]["sender_type"] == "user":
        hist_msgs = hist_msgs[1:]
        
    for msg in reversed(hist_msgs):
        role = "user" if msg["sender_type"] == "user" else "assistant"
        history.append({"role": role, "content": msg["content"]})

    context = ""
    # Fetch document content for context
    cursor = documents_col.find({"workspace_id": workspace_id})
    docs = await cursor.to_list(length=20)
    
    if docs:
        context = "The user has provided the following study materials/PDF content for context:\n"
        total_chars = 0
        for doc in docs:
            if doc.get('content_text'):
                text = doc['content_text'][:4000]
                if total_chars + len(text) > 12000: break
                context += f"--- DOCUMENT: {doc['name']} ---\n{text}\n\n"
                total_chars += len(text)

    # ── Modular AI Pipeline (Replaces monolithic response generation) ──
    pipeline_result = await pipeline.process(
        message=message.content,
        user_email=user_email,
        workspace_id=workspace_id,
        history=history,
        is_voice=message.request_audio,
    )
    
    ai_content = pipeline_result["content"]
    actual_model = pipeline_result["model"]
    raw_thinking = pipeline_result.get("thinking")  # leaked reasoning (if any)
    reflection_notes = pipeline_result.get("reflection_notes")  # self-reflection notes
    plan = pipeline_result.get("plan", {})

    # Build a structured thinking summary from the pipeline plan (always available)
    thinking_parts = []
    if plan:
        thinking_parts.append(
            f"🎯 Intent: {plan.get('intent', 'unknown').upper()}\n"
            f"💭 Emotion: {plan.get('emotion', 'neutral').upper()}\n"
            f"📐 Style: {plan.get('teaching_style', 'professor')} | "
            f"Length: {plan.get('response_length', 'balanced')}\n"
            f"🤖 Agent: {plan.get('agent_name', 'Professor')}\n"
            f"🛠 Content: "
            + ", ".join([
                flag.replace("use_", "").replace("_", " ")
                for flag in ["use_analogy","use_diagram","use_table","use_code_example","use_quiz","use_motivation","ask_followup"]
                if plan.get(flag)
            ] or ["standard"])
        )
    
    # Build reasoning explanation based on pipeline decisions
    reasoning_lines = []
    intent = plan.get('intent', 'unknown')
    emotion = plan.get('emotion', 'neutral')
    mastery = plan.get('difficulty', 'intermediate')
    teaching_style = plan.get('teaching_style', 'professor')
    response_length = plan.get('response_length', 'balanced')
    agent_name = plan.get('agent_name', 'Professor')
    
    # Explain why this agent was chosen
    if agent_name == 'Code Coach':
        reasoning_lines.append("Selected Code Coach — debug/code request detected")
    elif agent_name == 'Exam Coach':
        reasoning_lines.append("Selected Exam Coach — practice/quiz request detected")
    elif agent_name == 'Socratic Guide':
        reasoning_lines.append("Selected Socratic Guide — student is confused with low mastery, guiding through questions")
    elif agent_name == 'Peer Mentor':
        reasoning_lines.append("Selected Peer Mentor — student is confident with high mastery, peer-level explanation")
    elif agent_name == 'Casual Tutor':
        reasoning_lines.append("Selected Casual Tutor — quick question, casual response appropriate")
    else:
        reasoning_lines.append("Selected Professor — comprehensive teaching response")
    
    # Explain length decision
    if response_length == 'ultra_short':
        reasoning_lines.append("Short response — greeting or voice mode")
    elif response_length == 'short':
        reasoning_lines.append("Brief response — simple question or low engagement")
    elif response_length == 'comprehensive':
        reasoning_lines.append("Comprehensive response — deep explanation requested")
    
    # Explain emotion handling
    if emotion == 'FRUSTRATED':
        reasoning_lines.append("Student seems frustrated — using encouraging tone")
    elif emotion == 'CONFUSED':
        reasoning_lines.append("Student is confused — using simpler explanations")
    elif emotion == 'CURIOUS':
        reasoning_lines.append("Student is curious — providing detailed exploration")
    elif emotion == 'CONFIDENT':
        reasoning_lines.append("Student is confident — advancing to complex topics")
    
    # Add chain-of-thought if extracted
    if raw_thinking:
        # Filter out corrupted reasoning (e.g. models that generate <unk> tokens)
        if "<unk>" not in raw_thinking and len(raw_thinking) < 5000:
            reasoning_lines.append(f"\nModel's internal reasoning:\n{raw_thinking}")
    
    thinking_parts.append(f"\n🧠 Why this response:\n" + "\n".join(reasoning_lines))
    
    # Add self-reflection notes (if any)
    if reflection_notes:
        thinking_parts.append(f"\n🔄 Self-Reflection:\n{reflection_notes}")
    
    # Add tool usage info
    tools_used = pipeline_result.get("tools_used", [])
    if tools_used:
        thinking_parts.append(f"\n🔧 Tools Used: {', '.join(tools_used)}")
    
    # Add code execution info
    code_results = pipeline_result.get("code_results", [])
    if code_results:
        code_summary = []
        for cr in code_results:
            status = "✅" if cr.get("success") else "❌"
            lang = cr.get("language", "unknown")
            exec_time = cr.get("execution_time_ms", 0)
            code_summary.append(f"{status} {lang} ({exec_time}ms)")
        thinking_parts.append(f"\n💻 Code Execution: {', '.join(code_summary)}")

    ai_thinking = "\n".join(thinking_parts) if thinking_parts else None
    
    if isinstance(user, dict):
        user_name = user.get("full_name") or user.get("name") or "User"
    else:
        user_name = getattr(user, "full_name", None) or getattr(user, "name", "User")
    
    sources = pipeline_result.get("sources", [])

    ai_msg_data = {
        "id": str(uuid.uuid4()),
        "workspace_id": workspace_id,
        "sender": f"StudyFlow Tutor ({actual_model})",
        "sender_name": "StudyFlow Tutor",
        "sender_email": "ai@studyflow.ai",
        "sender_type": "ai",
        "content": ai_content,
        "thinking": ai_thinking,
        "sources": sources,
        "model_used": actual_model,
        "created_at": datetime.utcnow(),
        "audio_url": None
    }
    
    # Generate TTS if it was a voice request
    if message.request_audio:
        import re
        from app.services.podcast_service import generate_single_voice_response
        
        clean_text = ai_content
        # Remove code blocks
        clean_text = re.sub(r'```.*?```', '', clean_text, flags=re.DOTALL)
        # Remove inline code
        clean_text = re.sub(r'`.*?`', '', clean_text)
        # Remove links: [text](url) -> text
        clean_text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', clean_text)
        # Remove raw HTTP URLs
        clean_text = re.sub(r'http[s]?://\S+', '', clean_text)
        # Remove formatting symbols (*, _, #, ~, <, >)
        clean_text = re.sub(r'[*_#~<>]', '', clean_text)
        # Clean up whitespace
        clean_text = re.sub(r'\s+', ' ', clean_text).strip()
        
        audio_url = await generate_single_voice_response(clean_text)
        if audio_url:
            ai_msg_data["audio_url"] = audio_url

    await chat_messages_col.insert_one(ai_msg_data.copy())
    
    # Real-time broadcast
    from app.core.socket_manager import notify_workspace_update
    import asyncio
    asyncio.create_task(notify_workspace_update(workspace_id, 'new_message', ai_msg_data))
    
    return ai_msg_data

@router.post("/{workspace_id}/transcribe")
async def transcribe_voice(
    workspace_id: str, 
    audio: UploadFile = File(...), 
    user=Depends(get_current_user)
):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    perms = await verify_workspace_access(workspace_id, user_email)
    
    if not perms.get("can_message_ai", True):
        raise HTTPException(status_code=403, detail="The owner has disabled AI messaging for your account")
        
    audio_bytes = await audio.read()
    
    from app.services.stt_service import transcribe_audio_file
    transcribed_text = await transcribe_audio_file(audio_bytes, audio.filename or "recording.webm")
    
    if not transcribed_text:
        raise HTTPException(status_code=400, detail="Could not understand audio")
        
    return {"transcript": transcribed_text}
