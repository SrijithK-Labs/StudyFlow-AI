from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime

class WorkspaceBase(BaseModel):
    title: str
    description: Optional[str] = None
    icon: Optional[str] = "#"

class WorkspaceCreate(WorkspaceBase):
    pass

class PodcastEntry(BaseModel):
    id: str
    url: str
    title: str
    created_at: datetime

class Workspace(WorkspaceBase):
    id: str
    member_count: int
    created_at: datetime
    owner_email: Optional[str] = None
    join_code: Optional[str] = None
    join_code_expires_at: Optional[datetime] = None
    podcasts: Optional[List[PodcastEntry]] = []
    
    model_config = ConfigDict(from_attributes=True)

class WorkspaceMember(BaseModel):
    id: str
    workspace_id: str
    user_email: str
    role: str # 'OWNER', 'EDITOR', 'VIEWER'
    can_message_ai: bool = True
    status: str = 'ACCEPTED' # 'PENDING', 'ACCEPTED'
class PrivateWorkspaceCreate(BaseModel):
    title: str
    friends: list[str]
