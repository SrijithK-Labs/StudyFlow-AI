import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from app.api.v1.endpoints import chat, workspaces, ai, auth, documents, educational

app = FastAPI(
    title="StudyFlow AI API",
    description="Backend API for StudyFlow AI plataforma",
    version="1.0.0",
)

# Mandatory for OAuth state management
app.add_middleware(SessionMiddleware, secret_key=os.environ.get("SESSION_SECRET_KEY", "change-me-in-production"))

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Production should be more restrictive
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to StudyFlow AI API", "status": "online"}

from app.core.socket_manager import sio_app

# ... existing code ...

# Include routers
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(workspaces.router, prefix="/api/v1/workspaces", tags=["workspaces"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["ai"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["documents"])
app.include_router(educational.router, prefix="/api/v1/educational", tags=["educational"])

from fastapi.staticfiles import StaticFiles
import os

# Ensure static dir exists
static_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "static")
if not os.path.exists(static_path):
    os.makedirs(static_path, exist_ok=True)

app.mount("/static", StaticFiles(directory=static_path), name="static")

# Mount Socket.io app
app.mount("/", sio_app)
