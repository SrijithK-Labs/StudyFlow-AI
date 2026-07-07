"""
Module 7 — Prompt Builder
Assembles the final LLM prompt from all module outputs.
Loads all prompt text from prompts.yaml — zero hardcoded text.
No AI required — string templating, ~1ms latency.
"""
import os
import yaml
from datetime import datetime
from .response_planner import ResponsePlan

# ── Load prompts from YAML ──────────────────────────────────

_PROMPTS_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "prompts.yaml")

def _load_prompts() -> dict:
    with open(_PROMPTS_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

_PROMPTS = _load_prompts()


class PromptBuilder:
    """
    Builds the final messages array for the LLM by composing
    modular prompt fragments from prompts.yaml.
    """

    def __init__(self):
        # Reload prompts on each instantiation (for dev hot-reload)
        global _PROMPTS
        _PROMPTS = _load_prompts()

    # ── Main Build Method ────────────────────────────────────

    def build(
        self,
        plan: ResponsePlan,
        profile,        # UserProfile
        progress,       # ProgressSnapshot
        knowledge,      # KnowledgeContext
        message: str,
        history: list | None = None,
    ) -> dict:
        """
        Build the complete messages array for the LLM.
        Returns: {"messages": [...], "max_tokens": int}
        """
        system_parts: list[str] = []

        # 1 — Role identity
        role_templates = _PROMPTS.get("role_templates", {})
        role_text = role_templates.get(
            plan.teaching_style,
            role_templates.get("professor", "You are a helpful tutor."),
        )
        system_parts.append(role_text)

        # 2 — Critical rules
        rules = _PROMPTS.get("critical_rules", {})
        system_parts.append(rules.get("anti_reasoning_leak", ""))

        # 3 — Date awareness
        now = datetime.now().strftime("%B %d, %Y, %I:%M %p")
        system_parts.append(f"Today's date and time is {now}.")

        # 4 — User context
        name = getattr(profile, "name", "Student")
        difficulty = getattr(profile, "difficulty", "beginner")
        topics = getattr(profile, "topics_learned", [])
        topics_str = ", ".join(topics[-5:]) if topics else "None yet"
        system_parts.append(
            f"Student name: {name}. "
            f"Level: {difficulty}. "
            f"Topics mastered: {topics_str}."
        )

        # 5 — Learning progress context
        struggling = getattr(progress, "topics_struggling", [])
        if struggling:
            weak_areas = rules.get("weak_areas", "")
            system_parts.append(weak_areas.replace("{topics}", ", ".join(struggling)))

        mastery = getattr(progress, "mastery_level", 0.0)
        if mastery > 0.7:
            system_parts.append(rules.get("high_mastery", ""))

        # 6 — Content instructions from the Response Plan
        instructions = self._build_instructions(plan)
        if instructions:
            system_parts.append("INSTRUCTIONS:\n" + "\n".join(f"- {i}" for i in instructions))

        # 7 — Formatting rules
        format_rules = _PROMPTS.get("format_rules", {})
        fmt = format_rules.get(plan.response_length, format_rules.get("balanced", ""))
        system_parts.append(f"FORMAT RULES: {fmt}")

        # 8 — Live search results (if any)
        search_raw = getattr(knowledge, "search_raw", "")
        if search_raw and search_raw.strip():
            citation_rule = rules.get("live_web_citation", "")
            system_parts.append(citation_rule.replace("{search_raw}", search_raw))

        # Assemble system prompt
        system_prompt = "\n\n".join(filter(None, system_parts))

        # Build messages array
        messages = [{"role": "system", "content": system_prompt}]

        # Conversation history
        if history:
            messages.extend(history)

        # User message (with document context if available)
        user_msg_templates = _PROMPTS.get("user_message", {})
        doc_text = getattr(knowledge, "documents", "")
        if doc_text and doc_text.strip():
            template = user_msg_templates.get("with_documents", "REFERENCE MATERIAL:\n{doc_text}\n\nQUESTION: {message}")
            user_content = template.replace("{doc_text}", doc_text).replace("{message}", message)
        else:
            user_content = message

        messages.append({"role": "user", "content": user_content})

        return {
            "messages": messages,
            "max_tokens": plan.max_tokens,
        }

    # ── Helpers ───────────────────────────────────────────────

    def _build_instructions(self, plan: ResponsePlan) -> list[str]:
        """Convert plan flags into natural-language instructions from YAML."""
        content_instructions = _PROMPTS.get("content_instructions", {})
        instructions: list[str] = []

        if plan.use_analogy:
            instructions.append(content_instructions.get("use_analogy", ""))
        if plan.use_diagram:
            instructions.append(content_instructions.get("use_diagram", ""))
        if plan.use_table:
            instructions.append(content_instructions.get("use_table", ""))
        if plan.use_code_example:
            instructions.append(content_instructions.get("use_code_example", ""))
        if plan.use_quiz:
            instructions.append(content_instructions.get("use_quiz", ""))
        if plan.use_motivation:
            instructions.append(content_instructions.get("use_motivation", ""))
        if plan.ask_followup:
            instructions.append(content_instructions.get("ask_followup", ""))

        return [i for i in instructions if i]
