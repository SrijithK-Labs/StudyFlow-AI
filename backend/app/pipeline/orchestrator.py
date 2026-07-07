"""
The Central AI Pipeline Orchestrator (v2)
Ties all modules together: Tool Registry, Monitor, Agent Router,
Adaptive RAG, Self-Reflection, Code Execution.
"""
import uuid
import time
from .intent_analyzer import IntentAnalyzer, Intent
from .emotion_analyzer import EmotionAnalyzer
from .user_memory import UserMemoryEngine
from .learning_progress import LearningProgressEngine
from .knowledge_retriever import KnowledgeRetriever
from .response_planner import ResponsePlanner
from .prompt_builder import PromptBuilder
from .llm_gateway import LLMGateway
from .response_validator import ResponseValidator
from .ui_formatter import UIFormatter
from .tool_registry import ToolRegistry, tool_registry
from .monitor import Monitor, monitor
from .agent_router import AgentRouter, agent_router
from .self_reflector import SelfReflector
from .code_executor import CodeExecutor, code_executor

from app.services.search_service import search_service
from app.core.mongodb import documents_col


class MongoDocService:
    async def get_workspace_docs(self, workspace_id: str):
        try:
            cursor = documents_col.find({"workspace_id": workspace_id})
            docs = await cursor.to_list(length=20)
            return docs
        except Exception:
            return []


document_service = MongoDocService()


class AIPipeline:
    """The central orchestrator for the modular AI architecture (v2)."""

    MAX_TOOL_ROUNDS = 3  # Max tool-call loops before returning

    def __init__(self):
        self.intent = IntentAnalyzer()
        self.emotion = EmotionAnalyzer()
        self.memory = UserMemoryEngine()
        self.progress = LearningProgressEngine()
        self.knowledge = KnowledgeRetriever(search_service, document_service)
        self.planner = ResponsePlanner()
        self.prompt_builder = PromptBuilder()
        self.llm = LLMGateway()
        self.validator = ResponseValidator()
        self.formatter = UIFormatter()

        # New v2 modules
        self.tools = tool_registry
        self.monitor = monitor
        self.router = agent_router
        self.reflector = SelfReflector(self.llm)
        self.code_exec = code_executor

    async def process(
        self,
        message: str,
        user_email: str,
        workspace_id: str,
        history: list | None = None,
        is_voice: bool = False,
    ) -> dict:
        """Run a user message through the entire AI pipeline (v2)."""

        request_id = str(uuid.uuid4())[:8]
        metrics = self.monitor.start_request(request_id, user_email, workspace_id)
        start_time = time.time()

        try:
            # ── Phase 1: Analyze ────────────────────────────────
            t = self.monitor.start_phase(metrics, "analyze")
            intent_result = self.intent.analyze(message, history, is_voice)
            emotion_result = self.emotion.analyze(message, history)
            profile = await self.memory.get_profile(user_email)
            progress = await self.progress.get_snapshot(user_email, intent_result.sub_topic)
            self.monitor.end_phase(metrics, "analyze", t)

            # ── Phase 1.5: Agent Routing ───────────────────────
            agent = self.router.route(intent_result, emotion_result, progress.mastery_level)
            metrics.intent = intent_result.intent.value
            metrics.emotion = emotion_result.emotion.value

            # ── Phase 2: Retrieve Knowledge (Adaptive RAG) ─────
            t = self.monitor.start_phase(metrics, "retrieve")
            knowledge = await self.knowledge.retrieve(
                query=message,
                workspace_id=workspace_id,
                needs_search=(intent_result.intent not in (Intent.GREET, Intent.VOICE_CHAT)),
            )
            self.monitor.end_phase(metrics, "retrieve", t)

            # ── Phase 3: Plan ───────────────────────────────────
            t = self.monitor.start_phase(metrics, "plan")
            plan = self.planner.plan(intent_result, emotion_result, profile, progress, user_message=message)
            # Override teaching style with agent's style if available
            if agent.style_override:
                plan.teaching_style = agent.style_override
            self.monitor.end_phase(metrics, "plan", t)

            # ── Phase 4: Build Prompt ───────────────────────────
            t = self.monitor.start_phase(metrics, "prompt_build")
            prompt_data = self.prompt_builder.build(
                plan, profile, progress, knowledge, message, history
            )
            self.monitor.end_phase(metrics, "prompt_build", t)

            # ── Phase 5: Generate (with tool-call loop) ────────
            t = self.monitor.start_phase(metrics, "llm_generate")
            llm_response = await self.llm.generate(
                messages=prompt_data["messages"],
                max_tokens=prompt_data["max_tokens"],
                tools=self.tools.get_tool_schemas() if not is_voice else None,
            )
            llm_latency = round((time.time() - t) * 1000, 2)
            self.monitor.log_llm_call(
                metrics, llm_response.get("model", ""),
                llm_response.get("tokens_used", 0), llm_latency,
                phase="main_generation",
            )
            self.monitor.end_phase(metrics, "llm_generate", t)

            # Track truncation
            was_truncated = llm_response.get("truncated", False)

            # ── Phase 5.5: Tool-Call Loop ──────────────────────
            tool_calls_used = []
            tool_search_sources = []  # Track search results from tool calls
            tool_rounds = 0
            content = llm_response.get("content", "")

            # Check if LLM wants to call tools (OpenRouter tool_calls format)
            raw_tool_calls = llm_response.get("tool_calls", [])
            while raw_tool_calls and tool_rounds < self.MAX_TOOL_ROUNDS:
                tool_rounds += 1
                tool_results = []
                for tc in raw_tool_calls:
                    fn = tc.get("function", {})
                    tool_name = fn.get("name", "")
                    try:
                        import json
                        args = json.loads(fn.get("arguments", "{}"))
                    except (json.JSONDecodeError, TypeError):
                        args = {}

                    result = await self.tools.execute(tool_name, args)
                    tool_calls_used.append(tool_name)

                    # Capture search results from web_search tool calls
                    if tool_name == "web_search" and isinstance(result, dict):
                        tool_results_list = result.get("results", [])
                        if tool_results_list:
                            tool_search_sources.extend(tool_results_list)

                    tool_results.append({
                        "tool_call_id": tc.get("id", ""),
                        "tool_name": tool_name,
                        "result": result,
                    })

                # Feed tool results back to LLM
                tool_messages = prompt_data["messages"] + [
                    {"role": "assistant", "content": content, "tool_calls": raw_tool_calls}
                ]
                for tr in tool_results:
                    tool_messages.append({
                        "role": "tool",
                        "tool_call_id": tr["tool_call_id"],
                        "content": str(tr["result"]),
                    })

                llm_response = await self.llm.generate(
                    messages=tool_messages,
                    max_tokens=prompt_data["max_tokens"],
                )
                content = llm_response.get("content", "")
                raw_tool_calls = llm_response.get("tool_calls", [])

            metrics.tools_used = tool_calls_used

            # ── Phase 6: Validate & Format ──────────────────────
            t = self.monitor.start_phase(metrics, "validate_format")
            validation = self.validator.validate(content, plan)

            # Handle corrupted/garbage responses
            if "corrupted_response" in validation.get("issues", []):
                self.monitor.end_phase(metrics, "validate_format", t)

                metrics.total_latency_ms = round((time.time() - start_time) * 1000)
                self.monitor.finish_request(metrics, error="corrupted_response")
                return {
                    "content": "I'm sorry, I encountered an error generating a response. Please try asking your question again.",
                    "thinking": None,
                    "reflection_notes": None,
                    "sources": [],
                    "model": llm_response.get("model", "unknown"),
                    "plan": {**plan.__dict__, "agent_id": agent.id, "agent_name": agent.name, "agent_avatar": agent.avatar},
                    "tokens_used": llm_response.get("tokens_used", 0),
                    "code_results": [],
                    "tools_used": [],
                    "request_id": request_id,
                    "truncated": False,
                }

            formatted = self.formatter.format(content, plan, validation)
            final_content = formatted["content"]
            thinking = formatted["thinking"]
            self.monitor.end_phase(metrics, "validate_format", t)

            # ── Phase 6.5: Self-Reflection (only for long/comprehensive) ──
            reflection_notes = None
            if plan.response_length in ("long", "comprehensive") and not is_voice:
                t = self.monitor.start_phase(metrics, "self_reflect")
                reflection = await self.reflector.reflect(final_content, message, plan)
                if reflection["was_improved"]:
                    final_content = reflection["content"]
                    # Build reflection notes separately
                    notes = []
                    if reflection.get("critique"):
                        notes.append(f"Self-critique:\n{reflection['critique']}")
                    notes.append("[Response was improved for better quality]")
                    reflection_notes = "\n\n".join(notes)
                    self.monitor.end_phase(metrics, "self_reflect", t)
                    # Log the reflection LLM call
                    self.monitor.log_llm_call(
                        metrics, "reflection", 0, 0, phase="self_reflection"
                    )
                else:
                    self.monitor.end_phase(metrics, "self_reflect", t)

            # ── Phase 6.7: Code Execution ──────────────────────
            code_results = []
            if plan.allow_code_execution and not is_voice:
                t = self.monitor.start_phase(metrics, "code_execution")
                code_blocks = self.code_exec.extract_code_blocks(final_content)
                for block in code_blocks[:3]:  # Max 3 code blocks
                    result = await self.code_exec.execute(block["code"], block["language"])
                    code_results.append({
                        "language": result.language,
                        "stdout": result.stdout,
                        "stderr": result.stderr,
                        "exit_code": result.exit_code,
                        "success": result.success,
                        "execution_time_ms": result.execution_time_ms,
                    })
                self.monitor.end_phase(metrics, "code_execution", t)

            # ── Phase 7: Update Memory ──────────────────────────
            await self.memory.update_after_interaction(user_email, intent_result.sub_topic)

            metrics.total_latency_ms = round((time.time() - start_time) * 1000)
            self.monitor.finish_request(metrics)

            # Append truncation warning if response was cut off
            if was_truncated and final_content:
                truncation_note = "\n\n---\n⚠️ *This response was cut short due to length limits.*\n*Type* `continue` *or ask me to expand on any section above.*"
                final_content = final_content.rstrip() + truncation_note

            # Merge search sources from adaptive RAG and tool calls
            all_sources = list(knowledge.search_results) + tool_search_sources
            # Deduplicate by URL
            seen_urls = set()
            merged_sources = []
            for src in all_sources:
                url = src.get("url", "")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    merged_sources.append(src)

            return {
                "content": final_content,
                "thinking": thinking,
                "reflection_notes": reflection_notes,
                "sources": merged_sources,
                "model": llm_response.get("model", "unknown"),
                "plan": {
                    **plan.__dict__,
                    "agent_id": agent.id,
                    "agent_name": agent.name,
                    "agent_avatar": agent.avatar,
                },
                "tokens_used": llm_response.get("tokens_used", 0),
                "code_results": code_results,
                "tools_used": tool_calls_used,
                "request_id": request_id,
                "truncated": was_truncated,
            }

        except Exception as e:
            metrics.total_latency_ms = round((time.time() - start_time) * 1000)
            self.monitor.finish_request(metrics, error=str(e))
            raise


# Global singleton
pipeline = AIPipeline()
