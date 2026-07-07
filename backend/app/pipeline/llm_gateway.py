"""
Module 8 — LLM Gateway (v2)
The ONLY module that makes an external AI API call.
Sends prompts to Groq and returns the raw response.
Supports tool/function calling format.
"""
import os
import time
import httpx
from dotenv import load_dotenv
from app.services.ai_service import GROQ_MODEL

load_dotenv()


class LLMGateway:
    """
    Sends assembled prompts to Groq and returns the raw response.
    Supports Groq's tool/function calling format.
    """

    def __init__(self):
        self.api_key = os.environ.get("GROQ_API_KEY")
        self.url = "https://api.groq.com/openai/v1/chat/completions"

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def generate(
        self,
        messages: list,
        max_tokens: int = 2048,
        model: str | None = None,
        tools: list | None = None,
    ) -> dict:
        """
        Send messages to the LLM and return the response.
        Optionally passes tool definitions for function calling.

        Returns:
            {
                "content": str,
                "model": str,
                "tokens_used": int,
                "tool_calls": list,
            }
        """
        if not self.api_key:
            return {
                "content": "⚠️ GROQ_API_KEY is missing. Please add it to your .env file.",
                "model": "Configuration Error",
                "tokens_used": 0,
                "tool_calls": [],
            }

        model = model or GROQ_MODEL

        body = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
        }

        if tools:
            body["tools"] = tools
            body["tool_choice"] = "auto"

        try:
            start = time.time()
            async with httpx.AsyncClient(timeout=120) as client:
                res = await client.post(
                    self.url,
                    headers=self._headers(),
                    json=body,
                )
                latency_ms = round((time.time() - start) * 1000, 2)

                data = res.json()

                if res.status_code != 200:
                    error_msg = data.get("error", {}).get("message", "Unknown error")
                    return {
                        "content": f"⚠️ AI error ({res.status_code}): {error_msg}",
                        "model": f"Error {res.status_code}",
                        "tokens_used": 0,
                        "tool_calls": [],
                    }

                choice = data["choices"][0]
                message = choice.get("message", {})
                finish_reason = choice.get("finish_reason", "unknown")

                tool_calls = message.get("tool_calls", [])

                truncated = finish_reason == "length"

                return {
                    "content": message.get("content", ""),
                    "model": data.get("model", model),
                    "tokens_used": data.get("usage", {}).get("total_tokens", 0),
                    "tool_calls": tool_calls,
                    "latency_ms": latency_ms,
                    "truncated": truncated,
                }

        except Exception as e:
            return {
                "content": f"⚠️ Could not reach AI: {str(e)}",
                "model": "Critical Error",
                "tokens_used": 0,
                "tool_calls": [],
            }
