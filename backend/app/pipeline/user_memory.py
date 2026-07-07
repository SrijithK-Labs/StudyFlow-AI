"""
Module 3 — User Memory Engine
Tracks learning preferences and profile data in MongoDB. 
"""
from dataclasses import dataclass, field
from datetime import datetime
from app.core.mongodb import db

@dataclass
class UserProfile:
    email: str
    name: str = "Student"
    difficulty: str = "beginner"
    teaching_style: str = "professor"
    response_length: str = "detailed"
    use_analogies: bool = True
    use_emojis: bool = True
    topics_learned: list[str] = field(default_factory=list)
    weak_areas: list[str] = field(default_factory=list)
    total_messages: int = 0
    streak_days: int = 0


class UserMemoryEngine:
    def __init__(self):
        self.col = db["user_profiles"]
        self._cache: dict[str, UserProfile] = {}

    async def get_profile(self, email: str) -> UserProfile:
        # Check cache first
        if email in self._cache:
            return self._cache[email]

        doc = await self.col.find_one({"user_email": email})
        if not doc:
            profile = UserProfile(email=email)
            await self.col.insert_one({
                "user_email": email,
                "display_name": "Student",
                "preferences": {
                    "difficulty": "beginner",
                    "teaching_style": "professor",
                    "response_length": "detailed",
                    "use_analogies": True,
                    "use_emojis": True,
                },
                "topics_learned": [],
                "weak_areas": [],
                "total_messages": 0,
                "streak_days": 0,
                "created_at": datetime.utcnow(),
            })
        else:
            prefs = doc.get("preferences", {})
            profile = UserProfile(
                email=email,
                name=doc.get("display_name", "Student"),
                difficulty=prefs.get("difficulty", "beginner"),
                teaching_style=prefs.get("teaching_style", "professor"),
                response_length=prefs.get("response_length", "detailed"),
                use_analogies=prefs.get("use_analogies", True),
                use_emojis=prefs.get("use_emojis", True),
                topics_learned=doc.get("topics_learned", []),
                weak_areas=doc.get("weak_areas", []),
                total_messages=doc.get("total_messages", 0),
                streak_days=doc.get("streak_days", 0),
            )

        self._cache[email] = profile
        return profile

    async def update_after_interaction(self, email: str, topic: str | None = None):
        """Update metrics and learned topics after a message."""
        update_data = {
            "$inc": {"total_messages": 1},
            "$set": {"last_active": datetime.utcnow()}
        }
        
        if topic:
            update_data["$addToSet"] = {"topics_learned": topic}
            
        await self.col.update_one({"user_email": email}, update_data)
        
        # Invalidate cache so it's fresh next time
        self._cache.pop(email, None)
