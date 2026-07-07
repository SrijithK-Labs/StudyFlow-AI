"""
Module 11 — Tool Registry
Exposes backend capabilities (search, quiz, flashcard, diagram, podcast, code)
as callable tools that the LLM can invoke dynamically.
"""
import json
from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable


@dataclass
class ToolDefinition:
    name: str
    description: str
    parameters: dict  # JSON Schema format
    executor: Callable[..., Awaitable[Any]]


class ToolRegistry:
    """
    Registry of callable tools. The LLM can request tool execution,
    and the orchestrator routes calls through this registry.
    """

    def __init__(self):
        self._tools: dict[str, ToolDefinition] = {}
        self._register_builtins()

    def _register_builtins(self):
        """Register all built-in tools."""

        self.register(ToolDefinition(
            name="web_search",
            description="Search the web for real-time information on any topic.",
            parameters={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query"
                    }
                },
                "required": ["query"]
            },
            executor=self._exec_web_search,
        ))

        self.register(ToolDefinition(
            name="generate_quiz",
            description="Generate a multiple-choice quiz from study material.",
            parameters={
                "type": "object",
                "properties": {
                    "topic": {
                        "type": "string",
                        "description": "The topic or material to quiz on"
                    },
                    "count": {
                        "type": "integer",
                        "description": "Number of questions (default 5)"
                    }
                },
                "required": ["topic"]
            },
            executor=self._exec_generate_quiz,
        ))

        self.register(ToolDefinition(
            name="generate_flashcards",
            description="Generate study flashcards from material.",
            parameters={
                "type": "object",
                "properties": {
                    "topic": {
                        "type": "string",
                        "description": "The topic to create flashcards for"
                    },
                    "count": {
                        "type": "integer",
                        "description": "Number of flashcards (default 8)"
                    }
                },
                "required": ["topic"]
            },
            executor=self._exec_generate_flashcards,
        ))

        self.register(ToolDefinition(
            name="summarize_youtube",
            description="Summarize a YouTube video transcript into study notes.",
            parameters={
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "YouTube video URL"
                    }
                },
                "required": ["url"]
            },
            executor=self._exec_summarize_youtube,
        ))

    def register(self, tool: ToolDefinition):
        self._tools[tool.name] = tool

    def get_tool_schemas(self) -> list[dict]:
        """Return OpenRouter-compatible tool definitions."""
        return [
            {
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.parameters,
                }
            }
            for t in self._tools.values()
        ]

    async def execute(self, tool_name: str, arguments: dict) -> Any:
        """Execute a tool by name with the given arguments."""
        tool = self._tools.get(tool_name)
        if not tool:
            return {"error": f"Unknown tool: {tool_name}"}
        try:
            return await tool.executor(**arguments)
        except Exception as e:
            return {"error": f"Tool '{tool_name}' failed: {str(e)}"}

    def has_tool(self, tool_name: str) -> bool:
        return tool_name in self._tools

    def list_tools(self) -> list[str]:
        return list(self._tools.keys())

    # ── Built-in executors ──────────────────────────────────────

    async def _exec_web_search(self, query: str) -> dict:
        from app.services.search_service import search_service
        results = search_service.search_web(query)
        return {"results": results, "count": len(results)}

    async def _exec_generate_quiz(self, topic: str, count: int = 5) -> dict:
        from app.services.ai_service import generate_quiz
        result = await generate_quiz(topic, count=count)
        return {"quiz": result} if result else {"error": "Failed to generate quiz"}

    async def _exec_generate_flashcards(self, topic: str, count: int = 8) -> dict:
        from app.services.ai_service import generate_flashcards
        result = await generate_flashcards(topic, count=count)
        return {"flashcards": result} if result else {"error": "Failed to generate flashcards"}

    async def _exec_summarize_youtube(self, url: str) -> dict:
        from app.services.youtube_service import extract_transcript
        from app.services.ai_service import summarize_youtube_video
        transcript = await extract_transcript(url)
        if not transcript:
            return {"error": "Failed to extract YouTube transcript"}
        summary = await summarize_youtube_video(transcript)
        return {"summary": summary}


# Global singleton
tool_registry = ToolRegistry()
