"""
Module 10 — UI Formatter
Post-processes the LLM response for the specific output channel
(e.g., stripping markdown for Voice Mode, fixing broken markdown).
Reasoning detection patterns are loaded from prompts.yaml.
No AI required — ~1ms latency.
"""
import os
import re
import yaml
from .response_planner import ResponsePlan

# ── Load reasoning detection patterns from YAML ─────────────

_PROMPTS_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "prompts.yaml")

def _load_reasoning_starters() -> list[str]:
    try:
        with open(_PROMPTS_PATH, "r", encoding="utf-8") as f:
            prompts = yaml.safe_load(f)
        return prompts.get("reasoning_detection", {}).get("starters", [])
    except Exception:
        return []

_REASONING_STARTERS = _load_reasoning_starters()


class UIFormatter:
    """
    Formats and cleans the final response text before sending it to the user.
    """

    def format(self, content: str, plan: ResponsePlan, validation: dict) -> dict:
        """
        Returns: {"content": str, "thinking": str | None}
        """
        # FIRST: Extract any leaked chain-of-thought reasoning
        thinking, content = self._extract_reasoning(content)

        # Strip all markdown if it's a voice/call mode response
        if plan.response_length == "ultra_short":
            content = self._strip_markdown(content)

        # Strip emojis in voice mode (TTS engines often read them weirdly)
        if plan.response_length == "ultra_short":
             content = self._strip_emojis(content)

        # Fix structural markdown issues
        content = self._fix_code_fences(content)

        # Ensure interactive `<details>` tags are properly closed if used
        content = self._fix_html_tags(content)

        return {
            "content": content.strip(),
            "thinking": thinking,
        }

    def _extract_reasoning(self, text: str) -> tuple[str | None, str]:
        """
        Extracts leaked chain-of-thought reasoning from the response.
        Returns: (thinking_text or None, clean_content)
        Uses a dual strategy:
        1. <think> tags
        2. Heuristic: If response starts with a reasoning block, split it off.
        """
        thinking_parts: list[str] = []
        original_text = text

        # ── Strategy 1: Explicit reasoning tags ─────────────────────
        for tag in ["think", "reasoning", "internal", "thought"]:
            pattern = rf'<{tag}>(.*?)</{tag}>'
            matches = re.findall(pattern, text, flags=re.DOTALL)
            if matches:
                thinking_parts.extend(m.strip() for m in matches)
                text = re.sub(pattern, '', text, flags=re.DOTALL)

        # ── Strategy 2: Plain-text reasoning block detection ─────────
        # Uses patterns loaded from prompts.yaml
        stripped = text.strip()

        starts_with_reasoning = any(stripped.startswith(s) for s in _REASONING_STARTERS)

        if starts_with_reasoning:
            parts = stripped.split("\n\n")

            if len(parts) > 1:
                reasoning_end = len(parts)

                for i, part in enumerate(parts):
                    p = part.strip()
                    is_still_reasoning = any(p.startswith(s) for s in _REASONING_STARTERS)

                    is_short_response = len(p) < 300 and not is_still_reasoning
                    has_greeting = any(w in p.lower() for w in ["hi!", "hello!", "hey!", "hi again"])
                    is_quoted = p.startswith('"') or p.startswith('\u201c')

                    if not is_still_reasoning and (is_short_response or has_greeting or is_quoted):
                        reasoning_end = i
                        break

                if reasoning_end > 0:
                    thinking_block = "\n\n".join(parts[:reasoning_end]).strip()
                    actual_response = "\n\n".join(parts[reasoning_end:]).strip()

                    if actual_response:
                        thinking_parts.append(thinking_block)
                        text = actual_response

        thinking = "\n\n".join(thinking_parts).strip() if thinking_parts else None
        return (thinking, text.strip())

    def _strip_markdown(self, text: str) -> str:
        """Removes markdown formatting for plain speech."""
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)                 # Bold
        text = re.sub(r'\*(.*?)\*', r'\1', text)                     # Italic
        text = re.sub(r'`(.*?)`', r'\1', text)                       # Inline code
        text = re.sub(r'^#+\s*', '', text, flags=re.MULTILINE)       # Headers
        text = re.sub(r'^\s*[-*]\s+', '', text, flags=re.MULTILINE)  # Lists
        text = re.sub(r'```.*?```', '', text, flags=re.DOTALL)       # Full code blocks
        return text

    def _strip_emojis(self, text: str) -> str:
        """Removes emojis so TTS doesn't say 'grinning face'."""
        return re.sub(r'[^\x00-\x7F]+', '', text)

    def _fix_code_fences(self, text: str) -> str:
        """Fixes unclosed markdown code fences."""
        open_count = text.count("```")
        if open_count % 2 != 0:
            text += "\n```"
        return text

    def _fix_html_tags(self, text: str) -> str:
        """Fixes unclosed <details> and <summary> tags."""
        details_open = text.count("<details>")
        details_closed = text.count("</details>")
        if details_open > details_closed:
            text += "\n</details>"

        return text
