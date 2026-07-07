import socketio
import json
from datetime import datetime
from typing import Dict, List, Any

def json_serializable(obj):
    """Recursively convert datetime objects to strings and other MongoDB types to serializable formats"""
    if isinstance(obj, dict):
        return {k: json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [json_serializable(i) for i in obj]
    elif isinstance(obj, datetime):
        return obj.isoformat()
    # Add other types if needed, like ObjectId:
    # elif isinstance(obj, ObjectId): return str(obj)
    return obj

# Create an Async Server instance
sio_server = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=[], # Let FastAPI handle CORS headers
    engineio_logger=True,
    logger=True
)

# Combined ASGI application for FastAPI
sio_app = socketio.ASGIApp(
    socketio_server=sio_server,
    socketio_path='socket.io'
)

@sio_server.event
async def connect(sid, environ, auth):
    await sio_server.emit('welcome', {'sid': sid}, to=sid)

@sio_server.event
async def disconnect(sid):
    pass

@sio_server.event
async def join_room(sid, data: Dict[str, Any]):
    room = data.get("room")
    if room:
        await sio_server.enter_room(sid, room)

@sio_server.event
async def leave_room(sid, data: Dict[str, Any]):
    room = data.get("room")
    if room:
        await sio_server.leave_room(sid, room)

@sio_server.event
async def join_workspace(sid, data: Dict[str, Any]):
    workspace_id = data.get("workspace_id")
    if workspace_id:
        await sio_server.enter_room(sid, workspace_id)
        await sio_server.emit('room_joined', {'workspace_id': workspace_id}, to=sid)

@sio_server.event
async def leave_workspace(sid, data: Dict[str, Any]):
    workspace_id = data.get("workspace_id")
    if workspace_id:
        await sio_server.leave_room(sid, workspace_id)

async def broadcast_invite(user_email: str, invite_data: Dict[str, Any]):
    """Send an invite notification to a specific user by their email 'room'"""
    # Ensure payload is serializable
    serializable_payload = json_serializable(invite_data)
    await sio_server.emit('new_invite', serializable_payload, room=user_email)

async def notify_workspace_update(workspace_id: str, event: str, payload: Any):
    """Notify all members in a workspace room of an event (e.g., new message, permission change)"""
    # Ensure payload is serializable (MongoDB datetimes, etc)
    serializable_payload = json_serializable(payload)
    await sio_server.emit(event, serializable_payload, room=workspace_id)
