from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime

class Message(BaseModel):
    id: str
    sender: str
    sender_name: Optional[str] = None
    sender_email: Optional[str] = None
    sender_type: str  # "user" or "ai"
    content: str
    audio_url: Optional[str] = None
    thinking: Optional[str] = None
    sources: Optional[List[dict]] = None  # Each source: {"title": str, "url": str, "snippet": str}
    created_at: datetime

class MemberMessage(BaseModel):
    id: str
    workspace_id: str
    sender_name: str
    sender_email: str
    content: str
    created_at: datetime

class MemberMessageCreate(BaseModel):
    content: str

class ChatSession(BaseModel):
    workspace_id: str
    messages: List[Message]
