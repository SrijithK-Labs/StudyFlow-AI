from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.schemas.workspace import Workspace, WorkspaceCreate, PrivateWorkspaceCreate
from datetime import datetime, timedelta, timezone
import uuid

from app.core.mongodb import workspaces_col, members_col, chat_messages_col, documents_col
from app.api.v1.dependencies import get_current_user

router = APIRouter()

@router.get("/", response_model=List[Workspace])
async def get_workspaces(user=Depends(get_current_user)):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    
    # 1. Fetch workspaces owned by user
    owned_cursor = workspaces_col.find({"owner_email": user_email})
    owned_data = await owned_cursor.to_list(length=100)
    
    # 2. Fetch shared workspaces
    member_cursor = members_col.find({"user_email": user_email, "status": "ACCEPTED"})
    memberships = await member_cursor.to_list(length=100)
    
    if memberships:
        ws_ids = [m["workspace_id"] for m in memberships]
        shared_cursor = workspaces_col.find({"id": {"$in": ws_ids}})
        shared_data = await shared_cursor.to_list(length=100)
        # Avoid duplicates if user is owner and member (shouldn't happen but safe)
        owned_ids = {ws["id"] for ws in owned_data}
        for ws in shared_data:
            if ws["id"] not in owned_ids:
                owned_data.append(ws)

    # 3. Enrich member counts and Migrate old podcasts
    for ws in owned_data:
        # Count accepted members
        count = await members_col.count_documents({"workspace_id": ws["id"], "status": "ACCEPTED"})
        ws["member_count"] = count + 1 # +1 for owner
        
        # Runtime Migration: Move old 'podcast_url' to 'podcasts' array
        if "podcast_url" in ws and not ws.get("podcasts"):
            ws["podcasts"] = [{
                "id": "legacy-" + str(uuid.uuid4())[:8],
                "url": ws["podcast_url"],
                "title": "Legacy Recording",
                "created_at": ws.get("created_at") or datetime.utcnow()
            }]
            
        if "_id" in ws: ws["_id"] = str(ws["_id"])
        
    return owned_data


@router.post("/private", response_model=Workspace)
async def create_private_workspace(workspace: PrivateWorkspaceCreate, user=Depends(get_current_user)):
    """Create a private workspace and invite friends by email"""
    user_email = user.get("email") if isinstance(user, dict) else user.email
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    # Create workspace
    new_workspace = {
        "title": workspace.title,
        "description": "Private chat",
        "icon": "#",
        "member_count": len(workspace.friends) + 1,
        "owner_email": user_email,
        "is_private": True
    }
    resp = supabase.table("workspaces").insert(new_workspace).execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Failed to create private workspace")
    ws = resp.data[0]
    # Insert members
    for friend in workspace.friends:
        member = {
            "workspace_id": ws["id"],
            "user_email": friend.strip(),
            "role": "EDITOR",
            "can_message_ai": False,
            "status": "ACCEPTED"
        }
        supabase.table("workspace_members").insert(member).execute()
        # Send real-time invite
        from app.core.socket_manager import broadcast_invite
        await broadcast_invite(friend.strip(), {"workspace_title": ws["title"], "invited_by": user_email, "workspace_id": ws["id"]})
    return ws

@router.post("/", response_model=Workspace)
async def create_workspace(workspace: WorkspaceCreate, user=Depends(get_current_user)):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    
    new_workspace = {
        "id": str(uuid.uuid4()),
        "title": workspace.title,
        "description": workspace.description,
        "icon": workspace.icon,
        "member_count": 1,
        "owner_email": user_email,
        "created_at": datetime.utcnow()
    }
    
    await workspaces_col.insert_one(new_workspace.copy())
    return new_workspace

@router.delete("/{workspace_id}")
async def delete_workspace(workspace_id: str, user=Depends(get_current_user)):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    
    # Check permissions
    ws = await workspaces_col.find_one({"id": workspace_id})
    if not ws or ws.get("owner_email") != user_email:
        raise HTTPException(status_code=403, detail="Only the owner can delete this workspace")

    # Cascaded cleanup
    from app.core.mongodb import member_messages_col
    await chat_messages_col.delete_many({"workspace_id": workspace_id})
    await member_messages_col.delete_many({"workspace_id": workspace_id})
    await members_col.delete_many({"workspace_id": workspace_id})
    await documents_col.delete_many({"workspace_id": workspace_id})
    
    await workspaces_col.delete_one({"id": workspace_id})
    
    # Broadcast
    from app.core.socket_manager import notify_workspace_update
    import asyncio
    asyncio.create_task(notify_workspace_update(workspace_id, 'workspace_deleted', {"workspace_id": workspace_id}))
    
    return {"status": "success", "message": "Workspace deleted"}

@router.post("/{workspace_id}/generate-code")
async def generate_join_code(workspace_id: str, user=Depends(get_current_user)):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    
    ws = await workspaces_col.find_one({"id": workspace_id})
    if not ws or ws.get("owner_email") != user_email:
        raise HTTPException(status_code=403, detail="Only owners can generate join codes")

    import random, string
    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    
    await workspaces_col.update_one(
        {"id": workspace_id},
        {"$set": {
            "join_code": code,
            "join_code_expires_at": expires_at
        }}
    )
    
    return {"code": code, "expires_at": expires_at.isoformat()}

from pydantic import BaseModel

class JoinRequest(BaseModel):
    code: str

@router.post("/join")
async def join_workspace(request: JoinRequest, user=Depends(get_current_user)):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    code = request.code.upper()
    
    # Find workspace with this code
    workspace = await workspaces_col.find_one({"join_code": code})
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Invalid join code")
    
    expires_at = workspace.get("join_code_expires_at")
    if expires_at:
        # MongoDB stores datetimes natively, but let's be safe
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        
        if datetime.now(timezone.utc) > expires_at.replace(tzinfo=timezone.utc):
            raise HTTPException(status_code=400, detail="Join code has expired")

    # Add user to members
    member_data = {
        "id": str(uuid.uuid4()),
        "workspace_id": workspace["id"],
        "user_email": user_email,
        "role": "EDITOR",
        "can_message_ai": False,
        "status": "ACCEPTED",
        "joined_at": datetime.utcnow()
    }
    
    try:
        # Check if already a member
        existing = await members_col.find_one({"workspace_id": workspace["id"], "user_email": user_email})
        if existing:
            raise HTTPException(status_code=400, detail="You are already a member of this workspace")
            
        await members_col.insert_one(member_data)
        
        # Increment member count
        await workspaces_col.update_one(
            {"id": workspace["id"]},
            {"$inc": {"member_count": 1}}
        )
        return {"status": "success", "workspace_id": workspace["id"], "title": workspace["title"]}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Failed to join: {str(e)}")

@router.get("/{workspace_id}/members")
async def get_workspace_members(workspace_id: str, user=Depends(get_current_user)):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    
    # Verify access
    ws = await workspaces_col.find_one({"id": workspace_id})
    if not ws: raise HTTPException(status_code=404, detail="Workspace not found")
    
    is_owner = ws.get("owner_email") == user_email
    if not is_owner:
        mem = await members_col.find_one({"workspace_id": workspace_id, "user_email": user_email})
        if not mem: raise HTTPException(status_code=403, detail="Access denied")

    cursor = members_col.find({"workspace_id": workspace_id})
    members = await cursor.to_list(length=100)
    for m in members:
        if "_id" in m: m["_id"] = str(m["_id"])
    return members

class MemberUpdate(BaseModel):
    can_message_ai: bool

@router.patch("/{workspace_id}/members/{member_email}")
async def update_member_permission(workspace_id: str, member_email: str, update: MemberUpdate, user=Depends(get_current_user)):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    
    ws = await workspaces_col.find_one({"id": workspace_id})
    if not ws or ws.get("owner_email") != user_email:
        raise HTTPException(status_code=403, detail="Only owners can manage permissions")

    await members_col.update_one(
        {"workspace_id": workspace_id, "user_email": member_email},
        {"$set": {"can_message_ai": update.can_message_ai}}
    )
    
    # Broadcast
    from app.core.socket_manager import notify_workspace_update
    import asyncio
    asyncio.create_task(notify_workspace_update(workspace_id, 'member_permission_updated', {
        "workspace_id": workspace_id,
        "member_email": member_email,
        "can_message_ai": update.can_message_ai
    }))

    return {"status": "success"}

@router.delete("/{workspace_id}/leave")
async def leave_workspace(workspace_id: str, user=Depends(get_current_user)):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    
    ws = await workspaces_col.find_one({"id": workspace_id})
    if ws and ws.get("owner_email") == user_email:
        raise HTTPException(status_code=400, detail="Owner cannot leave workspace. Please delete it instead.")

    res = await members_col.delete_one({"workspace_id": workspace_id, "user_email": user_email})
    
    if res.deleted_count > 0:
        await workspaces_col.update_one({"id": workspace_id}, {"$inc": {"member_count": -1}})
        
        from app.core.socket_manager import notify_workspace_update
        import asyncio
        asyncio.create_task(notify_workspace_update(workspace_id, 'member_left', {
            "workspace_id": workspace_id,
            "user_email": user_email
        }))
        return {"status": "success"}
    
    raise HTTPException(status_code=404, detail="Membership not found")

@router.delete("/{workspace_id}/kick/{member_email}")
async def kick_member(workspace_id: str, member_email: str, user=Depends(get_current_user)):
    user_email = user.get("email") if isinstance(user, dict) else user.email
    
    ws = await workspaces_col.find_one({"id": workspace_id})
    if not ws or ws.get("owner_email") != user_email:
        raise HTTPException(status_code=403, detail="Only owners can kick members")

    if member_email == user_email:
        raise HTTPException(status_code=400, detail="Owner cannot kick themselves")

    res = await members_col.delete_one({"workspace_id": workspace_id, "user_email": member_email})
    
    if res.deleted_count > 0:
        await workspaces_col.update_one({"id": workspace_id}, {"$inc": {"member_count": -1}})
        
        from app.core.socket_manager import notify_workspace_update
        import asyncio
        # Broadcast to kicked user
        asyncio.create_task(notify_workspace_update(workspace_id, 'user_kicked', {
            "workspace_id": workspace_id,
            "user_email": member_email
        }))
        # Broadcast to members
        asyncio.create_task(notify_workspace_update(workspace_id, 'member_removed', {
            "workspace_id": workspace_id,
            "member_email": member_email
        }))
        return {"status": "success"}
        
    raise HTTPException(status_code=404, detail="Member not found")
