"""
Module 14 — Agent Router
Routes to specialist AI agents based on intent, emotion, and mastery.
"""
from dataclasses import dataclass
from .intent_analyzer import Intent, IntentResult
from .emotion_analyzer import Emotion, EmotionResult


@dataclass
class AgentPersona:
    id: str
    name: str
    avatar: str
    description: str
    style_override: str | None = None


# ── Built-in Agent Personas ───────────────────────────────────

AGENTS: dict[str, AgentPersona] = {
    "professor": AgentPersona(
        id="professor",
        name="Professor",
        avatar="professor",
        description="Default teaching persona — academic depth with clarity",
    ),
    "code_coach": AgentPersona(
        id="code_coach",
        name="Code Coach",
        avatar="coach",
        description="Specialized in programming, debugging, and code review",
        style_override="pair_programmer",
    ),
    "socratic_guide": AgentPersona(
        id="socratic_guide",
        name="Socratic Guide",
        avatar="socratic",
        description="Guides through questions instead of giving answers",
        style_override="socratic",
    ),
    "exam_coach": AgentPersona(
        id="exam_coach",
        name="Exam Coach",
        avatar="coach",
        description="Focused on practice, quizzes, and exam preparation",
        style_override="coach",
    ),
    "peer_mentor": AgentPersona(
        id="peer_mentor",
        name="Peer Mentor",
        avatar="peer",
        description="Collaborative peer for advanced students",
        style_override="peer",
    ),
    "casual_tutor": AgentPersona(
        id="casual_tutor",
        name="Casual Tutor",
        avatar="casual",
        description="Friendly, light explanations for quick questions",
        style_override="casual",
    ),
}


class AgentRouter:
    """
    Selects the best agent persona based on analyzed signals.
    Pure algorithmic — no LLM call, ~0ms latency.
    """

    def route(
        self,
        intent_result: IntentResult,
        emotion_result: EmotionResult,
        mastery: float,
    ) -> AgentPersona:
        intent = intent_result.intent
        emotion = emotion_result.emotion

        # Debug/Code Review → Code Coach
        if intent in (Intent.DEBUG,):
            return AGENTS["code_coach"]

        # Practice/Quiz → Exam Coach
        if intent == Intent.PRACTICE:
            return AGENTS["exam_coach"]

        # Confused + low mastery → Socratic Guide
        if emotion == Emotion.CONFUSED and mastery < 0.3:
            return AGENTS["socratic_guide"]

        # Confident + high mastery → Peer Mentor
        if emotion == Emotion.CONFIDENT and mastery > 0.7:
            return AGENTS["peer_mentor"]

        # Search/Summarize/Greet → Casual Tutor
        if intent in (Intent.SEARCH, Intent.SUMMARIZE, Intent.GREET):
            return AGENTS["casual_tutor"]

        # Frustrated → Exam Coach (encouraging but structured)
        if emotion == Emotion.FRUSTRATED:
            return AGENTS["exam_coach"]

        # Default → Professor
        return AGENTS["professor"]

    def get_agent(self, agent_id: str) -> AgentPersona:
        return AGENTS.get(agent_id, AGENTS["professor"])

    def list_agents(self) -> list[dict]:
        return [
            {"id": a.id, "name": a.name, "description": a.description}
            for a in AGENTS.values()
        ]


# Global singleton
agent_router = AgentRouter()
