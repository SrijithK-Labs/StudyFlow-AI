"""
Module 1 — Intent Analyzer
Classifies user messages into discrete intent categories using
pattern matching. No AI required — pure Python, ~2ms latency.
"""
from dataclasses import dataclass
from enum import Enum
import re


class Intent(str, Enum):
    LEARN = "learn"
    PRACTICE = "practice"
    SOLVE = "solve"
    DEBUG = "debug"
    SEARCH = "search"
    GREET = "greet"
    FOLLOWUP = "followup"
    VOICE_CHAT = "voice_chat"
    SUMMARIZE = "summarize"
    COMPARE = "compare"


@dataclass
class IntentResult:
    intent: Intent
    confidence: float       # 0.0 - 1.0
    sub_topic: str | None   # extracted topic, e.g. "binary search"


class IntentAnalyzer:
    """
    Classifies user intent via regex pattern matching.
    Falls back to LEARN for ambiguous inputs.
    """

    PATTERNS: dict[Intent, list[str]] = {
        Intent.LEARN: [
            r"teach\s+me", r"explain", r"what\s+is", r"what\s+are",
            r"how\s+does", r"how\s+do", r"how\s+to", r"learn",
            r"tell\s+me\s+about", r"define", r"describe",
        ],
        Intent.PRACTICE: [
            r"quiz", r"test\s+me", r"exercise", r"challenge",
            r"practice", r"give\s+me\s+(a\s+)?question",
        ],
        Intent.SOLVE: [
            r"solve", r"calculate", r"find\s+the\s+answer",
            r"compute", r"evaluate", r"what\s+is\s+\d",
        ],
        Intent.DEBUG: [
            r"fix\s+this", r"debug", r"error", r"bug",
            r"not\s+working", r"traceback", r"exception",
        ],
        Intent.SEARCH: [
            r"\blatest\b", r"\bnews\b", r"\bcurrent\b",
            r"who\s+is", r"\btoday\b", r"right\s+now",
            r"release\s+date", r"price\s+of",
        ],
        Intent.GREET: [
            r"^(hi|hello|hey|good\s+(morning|afternoon|evening))\b",
            r"^(sup|yo|howdy)\b",
        ],
        Intent.SUMMARIZE: [
            r"summarize", r"tldr", r"brief\s+overview",
            r"sum\s+up", r"key\s+points", r"recap",
        ],
        Intent.COMPARE: [
            r"difference\s+between", r"\bvs\.?\b", r"compare",
            r"which\s+is\s+better", r"pros\s+and\s+cons",
        ],
    }

    # Words to strip when extracting the sub-topic
    _NOISE_WORDS = {
        "teach", "me", "explain", "what", "is", "are", "how", "does",
        "do", "to", "learn", "about", "tell", "define", "describe",
        "please", "can", "you", "the", "a", "an", "of", "in", "with",
    }

    def analyze(
        self,
        message: str,
        history: list | None = None,
        is_voice: bool = False,
    ) -> IntentResult:
        """Analyze a user message and return its intent."""

        # Voice mode overrides everything
        if is_voice:
            return IntentResult(Intent.VOICE_CHAT, 1.0, self._extract_topic(message))

        text = message.lower().strip()

        # Short messages with conversation history → follow-up
        if history and len(history) >= 2 and len(text.split()) <= 5:
            # Unless it matches a strong intent pattern
            strong_match = self._match_patterns(text)
            if strong_match is None or strong_match[1] < 0.8:
                return IntentResult(Intent.FOLLOWUP, 0.85, None)

        # Pattern matching
        match = self._match_patterns(text)
        if match:
            intent, confidence = match
            return IntentResult(intent, confidence, self._extract_topic(message))

        # Default: LEARN
        return IntentResult(Intent.LEARN, 0.5, self._extract_topic(message))

    def _match_patterns(self, text: str) -> tuple[Intent, float] | None:
        """Find the best matching intent pattern."""
        best_intent = None
        best_score = 0.0

        for intent, patterns in self.PATTERNS.items():
            for pattern in patterns:
                matches = re.findall(pattern, text)
                if matches:
                    score = min(0.7 + len(matches) * 0.15, 1.0)
                    if score > best_score:
                        best_intent = intent
                        best_score = score

        if best_intent is not None:
            return (best_intent, best_score)
        return None

    def _extract_topic(self, message: str) -> str | None:
        """Extract the likely topic from the message."""
        words = message.lower().split()
        topic_words = [w for w in words if w not in self._NOISE_WORDS and len(w) > 2]
        if topic_words:
            return " ".join(topic_words[:5])
        return None
