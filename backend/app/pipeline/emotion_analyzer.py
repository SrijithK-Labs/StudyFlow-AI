"""
Module 2 — Emotion Analyzer (v2)
Detects the user's emotional state via keyword scoring,
pattern matching, and contextual signals. No AI required — ~1ms latency.
"""
from dataclasses import dataclass
from enum import Enum
import re


class Emotion(str, Enum):
    CURIOUS = "curious"
    CONFUSED = "confused"
    FRUSTRATED = "frustrated"
    CONFIDENT = "confident"
    BORED = "bored"
    EXCITED = "excited"
    NEUTRAL = "neutral"


@dataclass
class EmotionResult:
    emotion: Emotion
    intensity: float   # 0.0 (mild) to 1.0 (strong)


class EmotionAnalyzer:
    """
    Detects user emotion from message text + conversation history.
    Uses weighted keyword scoring, phrase matching, and contextual signals.
    """

    # Strong signals — high confidence when matched
    STRONG_SIGNALS: dict[Emotion, list[str]] = {
        Emotion.CONFUSED: [
            "i don't understand", "i'm confused", "i'm lost",
            "makes no sense", "don't get it", "what do you mean",
            "i'm not following", "this is confusing", "can you clarify",
            "i don't follow", "wait, what", "huh?",
        ],
        Emotion.FRUSTRATED: [
            "this is frustrating", "i'm frustrated", "this sucks",
            "i hate this", "waste of time", "still not working",
            "keeps failing", "giving up", "this is impossible",
            "so annoying", "why isn't this working", "stupid",
            "i give up", "done with this", "fed up",
        ],
        Emotion.EXCITED: [
            "this is amazing", "i love this", "this is awesome",
            "so cool", "wow!", "brilliant!", "fantastic!",
            "perfect!", "exactly what i needed", "this is great",
        ],
        Emotion.CONFIDENT: [
            "i got it", "i understand now", "makes sense now",
            "that's clear", "i see", "got it", "easy",
            "i know this", "obvious", "simple enough",
        ],
        Emotion.BORED: [
            "whatever", "meh", "boring", "can we move on",
            "this is dull", "not interested", "skip this",
            "hurry up", "get to the point",
        ],
    }

    # Weak signals — need multiple matches or context
    WEAK_SIGNALS: dict[Emotion, list[str]] = {
        Emotion.CONFUSED: [
            "what", "huh", "unclear", "not clear",
            "wait", "hmm", "confused",
        ],
        Emotion.FRUSTRATED: [
            "ugh", "argh", "ughh", "seriously",
            "come on", "are you kidding", "really?",
        ],
        Emotion.CURIOUS: [
            "why", "how", "what if", "i wonder",
            "can you explain", "tell me more", "interesting",
            "that's cool", "fascinating", "neat",
        ],
        Emotion.CONFIDENT: [
            "i think i know", "pretty sure", "i believe",
            "sounds right", "that makes sense",
        ],
    }

    # Question patterns that indicate curiosity
    QUESTION_PATTERNS = [
        r"^(what|how|why|when|where|who|which)\b",
        r"\?$",
        r"can you",
        r"could you",
        r"would you",
        r"tell me",
        r"explain",
    ]

    # Frustration intensifiers (amplify existing frustration)
    FRUSTRATION_INTENSIFIERS = [
        "still", "again", "keeps", "always", "never",
        "every time", "over and over",
    ]

    # Confidence boosters
    CONFIDENCE_BOOSTERS = [
        "definitely", "absolutely", "certainly", "obviously",
        "clearly", "of course", "without a doubt",
    ]

    def analyze(
        self,
        message: str,
        history: list | None = None,
    ) -> EmotionResult:
        """Analyze the emotional state from the user's message."""
        text = message.lower().strip()
        original = message.strip()
        scores: dict[Emotion, float] = {}

        # 1 — Strong keyword matching (high weight)
        for emotion, phrases in self.STRONG_SIGNALS.items():
            for phrase in phrases:
                if phrase in text:
                    scores[emotion] = max(scores.get(emotion, 0.0), 0.8)

        # 2 — Weak keyword matching (lower weight, additive)
        for emotion, words in self.WEAK_SIGNALS.items():
            hits = sum(1 for w in words if w in text)
            if hits >= 2:
                scores[emotion] = max(scores.get(emotion, 0.0), 0.5 + hits * 0.1)
            elif hits == 1 and emotion not in scores:
                scores[emotion] = 0.3

        # 3 — Question detection → Curious
        is_question = any(re.search(p, text) for p in self.QUESTION_PATTERNS)
        if is_question:
            scores[Emotion.CURIOUS] = max(scores.get(Emotion.CURIOUS, 0.0), 0.6)

        # 4 — Exclamation marks (context-aware)
        e_count = original.count("!")
        if e_count >= 3:
            # Multiple ! = strong emphasis
            if Emotion.FRUSTRATED in scores:
                scores[Emotion.FRUSTRATED] = min(scores[Emotion.FRUSTRATED] + 0.2, 1.0)
            elif Emotion.EXCITED in scores:
                scores[Emotion.EXCITED] = min(scores[Emotion.EXCITED] + 0.3, 1.0)
            else:
                scores[Emotion.EXCITED] = 0.4
        elif e_count == 2:
            # Double ! = moderate emphasis
            if Emotion.FRUSTRATED in scores:
                scores[Emotion.FRUSTRATED] = min(scores[Emotion.FRUSTRATED] + 0.1, 1.0)
            elif Emotion.EXCITED in scores:
                scores[Emotion.EXCITED] = min(scores[Emotion.EXCITED] + 0.15, 1.0)
        # Single ! = just emphasis, don't change emotion

        # 5 — ALL CAPS words (not just ratio — check for actual shouted words)
        words = original.split()
        caps_words = [w for w in words if w.isupper() and len(w) > 1 and w.isalpha()]
        caps_ratio = len(caps_words) / max(len(words), 1)
        if caps_ratio > 0.5 and len(words) > 2:
            # Mostly caps = strong emphasis
            if Emotion.FRUSTRATED in scores:
                scores[Emotion.FRUSTRATED] = min(scores[Emotion.FRUSTRATED] + 0.3, 1.0)
            elif Emotion.EXCITED in scores:
                scores[Emotion.EXCITED] = min(scores[Emotion.EXCITED] + 0.2, 1.0)

        # 6 — Frustration intensifiers
        for intensifier in self.FRUSTRATION_INTENSIFIERS:
            if intensifier in text and Emotion.FRUSTRATED in scores:
                scores[Emotion.FRUSTRATED] = min(scores[Emotion.FRUSTRATED] + 0.15, 1.0)

        # 7 — Confidence boosters
        for booster in self.CONFIDENCE_BOOSTERS:
            if booster in text and Emotion.CONFIDENT in scores:
                scores[Emotion.CONFIDENT] = min(scores[Emotion.CONFIDENT] + 0.2, 1.0)

        # 8 — Repeated messages in history → Frustrated
        if history and len(history) >= 4:
            last_user_msgs = [
                m["content"].lower().strip()
                for m in history[-8:]
                if m.get("role") == "user"
            ]
            if len(last_user_msgs) >= 3:
                unique = set(last_user_msgs)
                if len(unique) <= 2:
                    scores[Emotion.FRUSTRATED] = max(
                        scores.get(Emotion.FRUSTRATED, 0.0), 0.85
                    )

        # 9 — Very short message with no emotion → Bored
        word_count = len(text.split())
        if word_count <= 2 and not scores:
            scores[Emotion.BORED] = 0.5
        elif word_count <= 3 and all(w in ["ok", "sure", "fine", "yeah", "yes", "no", "k", "yh", "yea"] for w in text.split()):
            scores[Emotion.BORED] = 0.6

        # 10 — Long thoughtful message → likely Curious or Confident
        if word_count > 20 and not scores:
            scores[Emotion.CURIOUS] = 0.4

        # Return the strongest signal, or NEUTRAL
        if not scores:
            return EmotionResult(Emotion.NEUTRAL, 0.5)

        top_emotion = max(scores, key=scores.get)  # type: ignore
        return EmotionResult(top_emotion, round(min(scores[top_emotion], 1.0), 2))
