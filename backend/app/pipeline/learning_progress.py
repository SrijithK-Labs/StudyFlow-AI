"""
Module 4 — Learning Progress Engine
Tracks mastery levels and recommends next topics in MongoDB.
"""
from dataclasses import dataclass
from app.core.mongodb import db

@dataclass
class ProgressSnapshot:
    current_topic: str | None
    mastery_level: float          # 0.0 - 1.0
    status: str                   # "not_started" | "learning" | "struggling" | "mastered"
    recommended_next: str | None
    topics_mastered: list[str]
    topics_struggling: list[str]


class LearningProgressEngine:
    def __init__(self):
        self.col = db["learning_progress"]

    async def get_snapshot(self, email: str, topic: str | None = None) -> ProgressSnapshot:
        doc = await self.col.find_one({"user_email": email})
        
        if not doc:
            return ProgressSnapshot(
                current_topic=topic,
                mastery_level=0.0,
                status="not_started",
                recommended_next=topic,
                topics_mastered=[],
                topics_struggling=[],
            )

        modules = doc.get("modules", {})
        mastered = [k for k, v in modules.items() if v.get("status") == "mastered"]
        struggling = [k for k, v in modules.items() if v.get("status") == "struggling"]

        current = modules.get(topic, {}) if topic else {}
        
        return ProgressSnapshot(
            current_topic=topic,
            mastery_level=current.get("score", 0.0),
            status=current.get("status", "not_started"),
            recommended_next=doc.get("recommended_next"),
            topics_mastered=mastered,
            topics_struggling=struggling,
        )

