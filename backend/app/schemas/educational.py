from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid

class QuizQuestion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    question: str
    options: List[str]
    correct_answer: str
    explanation: Optional[str] = None

class Quiz(BaseModel):
    id: str
    workspace_id: str
    title: str
    questions: List[QuizQuestion]
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Flashcard(BaseModel):
    id: str
    workspace_id: str
    front: str
    back: str
    mastery_level: int = 0  # 0 to 5
    last_reviewed: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class EducationalGenerationRequest(BaseModel):
    workspace_id: Optional[str] = None
    content: Optional[str] = None
    document_ids: Optional[List[str]] = None
    count: Optional[int] = 5
