"""
Module 6 — Response Planner (v2)
The 'brain' of the pipeline. Given all analyzed signals, it produces
a concrete ResponsePlan that controls the AI's behavior.
Now includes: allow_code_execution, agent_id fields.
"""
from dataclasses import dataclass, field
from .intent_analyzer import Intent, IntentResult
from .emotion_analyzer import Emotion, EmotionResult


@dataclass
class ResponsePlan:
    """The complete blueprint for how the AI should respond."""

    # Core decisions
    response_length: str
    teaching_style: str
    difficulty: str

    # Content flags
    use_analogy: bool
    use_diagram: bool
    use_table: bool
    use_quiz: bool
    use_code_example: bool
    use_motivation: bool
    ask_followup: bool

    # v2 additions
    allow_code_execution: bool = False
    enable_self_reflection: bool = True
    agent_id: str = "professor"

    # Metadata
    intent: str = ""
    emotion: str = ""
    max_tokens: int = 1500


class ResponsePlanner:
    """
    Decides HOW the AI should respond before a single word is generated.
    """

    TOKEN_MAP: dict[str, int] = {
        "ultra_short": 150,
        "short": 300,
        "medium": 800,
        "balanced": 2000,
        "long": 4096,
        "comprehensive": 8192,
    }

    # Code execution intents
    CODE_INTENTS = {Intent.DEBUG}
    
    # Keywords that request comprehensive responses
    COMPREHENSIVE_KEYWORDS = [
        "fully", "completely", "in detail", "detailed", "comprehensive",
        "thorough", "explain fully", "all about", "everything about",
        "deep dive", "elaborate", "full explanation",
    ]

    def plan(
        self,
        intent_result: IntentResult,
        emotion_result: EmotionResult,
        profile,
        progress,
        user_message: str = "",
    ) -> ResponsePlan:
        """Produce a ResponsePlan from all analyzed signals."""
        intent = intent_result.intent
        emotion = emotion_result.emotion
        mastery = progress.mastery_level

        length = self._decide_length(intent, emotion, profile, user_message)
        style = self._decide_style(intent, emotion, profile, mastery)
        content = self._decide_content(intent, emotion, mastery, intent_result.sub_topic)

        # v2: Code execution flag
        allow_code = intent in self.CODE_INTENTS

        # v2: Self-reflection for complex responses
        enable_reflect = length in ("balanced", "long", "comprehensive")

        return ResponsePlan(
            response_length=length,
            teaching_style=style,
            difficulty=profile.difficulty,
            max_tokens=self.TOKEN_MAP.get(length, 1500),
            allow_code_execution=allow_code,
            enable_self_reflection=enable_reflect,
            intent=intent.value,
            emotion=emotion.value,
            **content,
        )

    # ── Algorithm 1: Response Length ───────────────────────────────

    def _decide_length(self, intent: Intent, emotion: Emotion, profile, user_message: str = "") -> str:
        if intent == Intent.VOICE_CHAT:
            return "ultra_short"
        if intent == Intent.GREET:
            return "short"
        if intent == Intent.FOLLOWUP:
            return "medium"
        
        # Check for explicit comprehensive request keywords
        msg_lower = user_message.lower()
        wants_comprehensive = any(kw in msg_lower for kw in self.COMPREHENSIVE_KEYWORDS)
        if wants_comprehensive:
            return "comprehensive"
        
        if emotion == Emotion.FRUSTRATED:
            return "medium"  # Keep it digestible
        if emotion == Emotion.BORED:
            return "short"
        if intent in (Intent.SUMMARIZE, Intent.SEARCH):
            return "balanced"

        pref = getattr(profile, "response_length", "detailed")
        if pref == "brief":
            return "medium"
        elif pref == "balanced":
            return "balanced"

        if intent in (Intent.LEARN, Intent.COMPARE):
            return "comprehensive"

        return "long"

    # ── Algorithm 2: Teaching Style ──────────────────────────────

    def _decide_style(
        self, intent: Intent, emotion: Emotion, profile, mastery: float
    ) -> str:
        if emotion == Emotion.CONFUSED and mastery < 0.3:
            return "socratic"
        if intent == Intent.PRACTICE:
            return "coach"
        if intent == Intent.DEBUG:
            return "pair_programmer"
        if emotion == Emotion.CONFIDENT and mastery > 0.7:
            return "peer"
        if intent in (Intent.SEARCH, Intent.SUMMARIZE):
            return "casual"
        return getattr(profile, "teaching_style", "professor")

    # ── Algorithm 3: Content Decisions ───────────────────────────

    def _decide_content(
        self, intent: Intent, emotion: Emotion,
        mastery: float, topic: str | None,
    ) -> dict:
        plan = {
            "use_analogy": False,
            "use_diagram": False,
            "use_table": False,
            "use_quiz": False,
            "use_code_example": False,
            "use_motivation": False,
            "ask_followup": False,
        }

        topic_lower = (topic or "").lower()

        if intent == Intent.LEARN and mastery < 0.5:
            plan["use_analogy"] = True

        diagram_keywords = [
            "architecture", "flow", "process", "structure",
            "relationship", "tree", "graph", "pipeline",
            "lifecycle", "oop", "inheritance", "network",
        ]
        if any(kw in topic_lower for kw in diagram_keywords):
            plan["use_diagram"] = True

        if intent == Intent.COMPARE:
            plan["use_table"] = True

        if intent == Intent.LEARN and mastery >= 0.3:
            plan["use_quiz"] = True
        if intent == Intent.PRACTICE:
            plan["use_quiz"] = True

        code_keywords = [
            "python", "code", "function", "loop", "algorithm",
            "javascript", "sql", "api", "class", "variable",
            "array", "list", "dict", "string", "recursion",
            "sort", "search", "stack", "queue", "linked",
        ]
        if any(kw in topic_lower for kw in code_keywords):
            plan["use_code_example"] = True
        if intent == Intent.DEBUG:
            plan["use_code_example"] = True

        if emotion == Emotion.FRUSTRATED:
            plan["use_motivation"] = True

        if emotion == Emotion.CURIOUS and intent == Intent.LEARN:
            plan["ask_followup"] = True

        return plan
