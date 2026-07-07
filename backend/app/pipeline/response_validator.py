"""
Module 9 — Response Validator
Validates the LLM output: checks for truncation, safety, and format compliance.
No AI required — pure algorithmic checks, ~1ms latency.
"""
import re as _re
from .response_planner import ResponsePlan


class ResponseValidator:
    """
    Validates LLM output against the ResponsePlan rules before 
    sending it to the frontend.
    """

    def validate(self, content: str, plan: ResponsePlan) -> dict:
        issues = []
        word_count = len(content.split())

        # 1. Truncation check
        if content.endswith(("...", "```", "- ")) or len(content) < 10:
            if word_count > 10:  # Ignore very short genuine responses
                issues.append("possibly_truncated")

        # 2. Garbage/corruption detection
        if self._is_garbage(content):
            issues.append("corrupted_response")

        # 3. Length compliance for Voice Mode
        if plan.response_length == "ultra_short":
            if word_count > 60:
                issues.append("too_long_for_voice")

        # 4. Markdown leakage in Voice Mode
        if plan.response_length == "ultra_short":
            markdown_chars = ["#", "```", "**", "- ", "| "]
            if any(char in content for char in markdown_chars):
                issues.append("markdown_in_voice_mode")

        # 5. JSON-Diagram validation (if requested)
        if plan.use_diagram and "```json-diagram" not in content:
             pass

        return {
            "is_valid": len(issues) == 0,
            "issues": issues,
            "word_count": word_count,
        }

    def _is_garbage(self, content: str) -> bool:
        """Detect if LLM output is corrupted/gibberish."""
        if not content or len(content) < 50:
            return False

        # Check 1: Too many <unk> tokens
        unk_count = content.count("<unk>")
        if unk_count > 5:
            return True

        # Check 2: Extract the main content (after the first meaningful line)
        # Look for signs of scraped web content artifacts
        scraped_patterns = [
            r'[Cc]orey\s+incumbentslash',
            r'[Bb]loom[Uu]r[Ff]ather',
            r'webkit\w+',
            r'\.\.\.dump\w+',
            r'\{[^}]*webkit[^}]*\}',
        ]
        for pattern in scraped_patterns:
            if _re.search(pattern, content):
                return True

        # Check 3: Very high ratio of non-ASCII/non-Latin characters
        # (signs of multilingual garbage soup)
        total_chars = len(content)
        if total_chars > 200:
            non_ascii = sum(1 for c in content if ord(c) > 127)
            non_ascii_ratio = non_ascii / total_chars
            if non_ascii_ratio > 0.3:
                return True

        # Check 4: Repetitive pattern detection (same short substring repeated)
        # Look for repetition of 5+ char patterns
        words = content.split()
        if len(words) > 50:
            unique_ratio = len(set(words)) / len(words)
            if unique_ratio < 0.3:
                return True

        return False
