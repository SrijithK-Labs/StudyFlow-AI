from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth
from starlette.config import Config
from datetime import datetime
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

router = APIRouter()

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")

config_data = {
    'GOOGLE_CLIENT_ID': GOOGLE_CLIENT_ID,
    'GOOGLE_CLIENT_SECRET': GOOGLE_CLIENT_SECRET,
}
starlette_config = Config(environ=config_data)
oauth = OAuth(starlette_config)

oauth.register(
    name='google',
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)

@router.get("/login")
async def login(request: Request, origin: str = None):
    # Dynamically determine the callback URI based on the current request host
    # This allows it to work on localhost, 192.168.*, and Tailscale IPs
    callback_uri = str(request.url_for('auth_callback'))
    
    # Priority for capturing the frontend's origin:
    # 1. 'origin' query parameter (most reliable, passed by frontend)
    # 2. 'referer' header (fallback)
    
    target_origin = origin
    if not target_origin:
        referer = request.headers.get("referer")
        if referer:
            target_origin = "/".join(referer.split("/")[:3]) # Extracts http://host:port

    if target_origin:
        request.session["frontend_origin"] = target_origin
    
    return await oauth.google.authorize_redirect(request, callback_uri)

@router.get("/callback", name="auth_callback")
async def auth_callback(request: Request):
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Authentication failed: {str(e)}")
    
    user_info = token.get('userinfo')
    if not user_info:
        raise HTTPException(status_code=400, detail="Failed to get user info from Google")
    
    # Extract info for the frontend
    user_name = user_info.get('name', 'User')
    user_email = user_info.get('email', '')
    user_picture = user_info.get('picture', '')
    
    # Persist user to MongoDB
    try:
        from app.core.mongodb import users_col
        user_data = {
            "email": user_email,
            "full_name": user_name,
            "picture": user_picture,
            "updated_at": datetime.utcnow()
        }
        await users_col.update_one(
            {"email": user_email},
            {"$set": user_data},
            upsert=True
        )
    except Exception as e:
        pass  # non-critical: user persistence failure
    
    # Determine frontend URL dynamically
    # 1. Check for FRONTEND_URL environment variable
    # 2. Check for saved origin in session (captured from Referer)
    # 3. Fallback to current host with port 3000
    env_frontend = os.environ.get("FRONTEND_URL")
    session_origin = request.session.get("frontend_origin")
    
    if env_frontend:
        frontend_url = f"{env_frontend.rstrip('/')}/auth/callback"
    elif session_origin:
        frontend_url = f"{session_origin.rstrip('/')}/auth/callback"
    else:
        backend_host = request.url.hostname
        frontend_url = f"http://{backend_host}:3000/auth/callback"
    
    return RedirectResponse(url=f"{frontend_url}?token=mock_jwt_token_for_{user_email}&name={user_name}&email={user_email}&picture={user_picture}")
