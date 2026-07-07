"""
Module 13 — Self Reflector
AI critiques its own response before presenting to the student.
Second LLM call for quality assurance.
"""
import yaml
import os

_PROMPTS_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "prompts.yaml")

def _load_reflection_prompt() -> str:
    try:
        with open(_PROMPTS_PATH, "r", encoding="utf-8") as f:
            prompts = yaml.safe_load(f)
        return prompts.get("reflection", {}).get("critique_prompt", "")
    except Exception:
        return ""


class SelfReflector:
    """
    Takes the AI's initial response and asks it to critique itself.
    If issues found, returns an improved version.
    """

    def __init__(self, llm_gateway):
        self.llm = llm_gateway
        self.enabled = True

    async def reflect(
        self,
        original_response: str,
        user_message: str,
        plan,
    ) -> dict:
        """
        Critique the response and optionally improve it.
        Returns: {"content": str, "was_improved": bool, "critique": str | None}
        """
        if not self.enabled:
            return {
                "content": original_response,
                "was_improved": False,
                "critique": None,
            }

        # Skip reflection for simple/greeting responses
        if plan.response_length in ("ultra_short", "short"):
            return {
                "content": original_response,
                "was_improved": False,
                "critique": None,
            }

        critique_prompt = _load_reflection_prompt()
        if not critique_prompt:
            return {
                "content": original_response,
                "was_improved": False,
                "critique": None,
            }

        messages = [
            {"role": "system", "content": critique_prompt},
            {"role": "user", "content": (
                f"STUDENT QUESTION: {user_message}\n\n"
                f"AI RESPONSE TO CRITIQUE:\n{original_response}\n\n"
                f"Analyze this response. If it has issues (wrong info, poor explanation, "
                f"missing key points, wrong tone), provide an IMPROVED version after the marker "
                f"---IMPROVED RESPONSE---. If the response is good, just output the original "
                f"after the marker."
            )},
        ]

        try:
            result = await self.llm.generate(messages=messages, max_tokens=1500)
            critique_text = result.get("content", "")

            if "---IMPROVED RESPONSE---" in critique_text:
                parts = critique_text.split("---IMPROVED RESPONSE---")
                critique = parts[0].strip()
                improved = parts[1].strip()
                
                # Check if critique indicates the response was already good
                is_pass = any(p in critique.lower() for p in ["pass", "is good", "no issues", "no changes needed"])
                
                if is_pass:
                    # Response was good, no improvement needed
                    return {
                        "content": original_response,
                        "was_improved": False,
                        "critique": None,
                    }
                
                if improved and len(improved) > len(original_response) * 0.3:
                    return {
                        "content": improved,
                        "was_improved": True,
                        "critique": critique,
                    }

            return {
                "content": original_response,
                "was_improved": False,
                "critique": None,
            }

        except Exception:
            return {
                "content": original_response,
                "was_improved": False,
                "critique": None,
            }
