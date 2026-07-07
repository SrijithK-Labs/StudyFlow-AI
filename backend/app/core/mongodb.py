import os
from dotenv import load_dotenv
import motor.motor_asyncio

load_dotenv()

MONGODB_URI = os.environ.get("MONGODB_URI")
MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME", "studyflow")

client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]

# ── Core Collections ─────────────────────────────────────────
users_col = db["users"]
workspaces_col = db["workspaces"]
members_col = db["workspace_members"]
chat_messages_col = db["chat_messages"]
member_messages_col = db["member_messages"]
documents_col = db["documents"]
quizzes_col = db["quizzes"]
flashcards_col = db["flashcards"]
