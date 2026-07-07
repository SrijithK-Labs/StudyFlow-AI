import os
import json
import yaml
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

_PROMPTS_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "prompts.yaml")

def _load_prompts() -> dict:
    with open(_PROMPTS_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

_PROMPTS = _load_prompts()

def _headers():
    return {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

async def _chat(messages: list, max_tokens: int = 2048, response_format: dict | None = None) -> dict | None:
    body = {
        "model": GROQ_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
    }
    if response_format:
        body["response_format"] = response_format
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            res = await client.post(GROQ_URL, headers=_headers(), json=body)
            if res.status_code == 200:
                return res.json()
    except Exception:
        pass
    return None

async def extract_concepts(content: str) -> list:
    extract_prompt = f"""Extract the main concepts from this study material. Return a list of concept names (short phrases) separated by new lines.

Study Material:
{content[:3000]}

List the key concepts that should be discussed in a podcast:
- Concept 1
- Concept 2
- Concept 3

Format: Each line must start with "- " followed by the concept name.
"""
    data = await _chat([{"role": "user", "content": extract_prompt}], max_tokens=4096)
    if data:
        try:
            raw_text = data["choices"][0]["message"]["content"]
            concepts = []
            for line in raw_text.strip().split('\n'):
                line = line.strip().lstrip("0123456789.-*• ")
                if line and len(line) > 3 and line[0].isupper():
                    concepts.append({"title": line[:50], "summary": f"Learn about {line}"})
            if concepts:
                return concepts[:10]
        except Exception:
            pass
    return [
        {"title": "Retrieval-Augmented Generation (RAG)", "summary": "Combines retrieval and generation for better AI answers"},
        {"title": "Prompt Engineering", "summary": "Designing effective instructions for AI models"},
        {"title": "How LLMs Work", "summary": "Understanding transformer architecture and tokenization"},
        {"title": "AI Limitations", "summary": "Hallucinations and accuracy challenges in AI responses"},
        {"title": "Podcast Format", "summary": "How to create engaging AI educational content"},
        {"title": "Learning Applications", "summary": "Using AI to enhance study and knowledge retention"}
    ]

async def generate_podcast_script(content: str, _depth: int = 0):
    if _depth > 2:
        return None
    if not GROQ_API_KEY:
        return None

    content = content[:6000]

    concepts = await extract_concepts(content)

    if not concepts:
        concepts = [
            {"title": "Retrieval-Augmented Generation (RAG)", "summary": "Combines retrieval and generation for better AI answers"},
            {"title": "Prompt Engineering", "summary": "Designing effective instructions for AI models"},
            {"title": "How LLMs Work", "summary": "Understanding transformer architecture and tokenization"},
            {"title": "AI Limitations", "summary": "Hallucinations and accuracy challenges in AI responses"},
            {"title": "Podcast Format", "summary": "How to create engaging AI educational content"},
            {"title": "Learning Applications", "summary": "Using AI to enhance study and knowledge retention"}
        ]

    concept_descriptions = []
    for i, concept in enumerate(concepts, 1):
        concept_descriptions.append(f"Concept {i}: {concept['title']}\nSummary: {concept['summary']}")
    concept_text = "\n\n".join(concept_descriptions)

    content_prompts = _PROMPTS.get("content_prompts", {})
    base_prompt = content_prompts.get("podcast", "")

    if not base_prompt:
        base_prompt = """Write a podcast dialogue between Professor Guy and Student Ava.
The material below contains the main concepts to discuss.

Guy teaches. Ava asks questions and reacts. Write like they are sitting in a room having a real conversation.

RULES:
1. Write 20-25 exchanges minimum (40-50 lines total). Each exchange = one Guy line + one Ava line.
2. Each line: 15-40 words. Natural speaking length.
3. Flow naturally: finish one concept before moving to the next.
4. Guy uses real-world analogies. Ava relates things to her own experience.
5. NEVER say filler phrases like "We'll explore" or "That's a great question".
6. NEVER read headers or labels from the content. Only discuss the actual concepts.
7. NO markdown, NO bullets, NO emojis. Plain spoken English.
8. Start: Guy introduces what they will discuss today. Ava says she is excited to learn.
9. End: Guy summarizes the key takeaways. Ava thanks the listeners.

FORMAT - return ONLY a JSON array (no other text):
[{{"speaker":"Guy","text":"..."}},{{"speaker":"Ava","text":"..."}}]

CONCEPTS TO DISCUSS:
{concept_descriptions}

ORIGINAL MATERIAL:
{content}
"""

    podcast_prompt = base_prompt.replace("{concept_descriptions}", concept_text).replace("{content}", content)

    for retry in range(3):
        data = await _chat([{"role": "user", "content": podcast_prompt}], max_tokens=3000)
        if data:
            break
        wait = [5, 10, 15][retry]
        await asyncio.sleep(wait)

    if not data:
        return None

    raw_text = None
    try:
        if "choices" not in data or not data["choices"]:
            return None

        if "message" not in data["choices"][0] or "content" not in data["choices"][0]["message"]:
            return None

        raw_text = data["choices"][0]["message"]["content"]

        if not raw_text or not raw_text.strip():
            return None

        clean = raw_text.strip()

        if clean.startswith("```"):
            lines = clean.split("\n")
            json_lines = []
            in_json = False
            for line in lines:
                if line.strip().startswith("[") and not in_json:
                    in_json = True
                    json_lines.append(line)
                elif in_json:
                    json_lines.append(line)
                    if line.strip().endswith("]"):
                        break
            if json_lines:
                clean = "\n".join(json_lines)

        try:
            result = json.loads(clean)
            if isinstance(result, dict):
                for key in result:
                    if isinstance(result[key], list):
                        result = result[key]
                        break
            if isinstance(result, list) and len(result) >= 20:
                return result
            elif isinstance(result, list) and len(result) > 0:
                retry_result = await generate_podcast_script(content, _depth + 1)
                if retry_result and len(retry_result) >= 20:
                    return retry_result
        except json.JSONDecodeError:
            pass

        import re
        match = re.search(r'\[.*\]', clean, re.DOTALL)
        if match:
            try:
                result = json.loads(match.group())
                if isinstance(result, list) and len(result) >= 20:
                    return result
            except json.JSONDecodeError:
                pass

        return None

    except Exception:
        return None


async def generate_quiz(content: str, count: int = 5):
    if not GROQ_API_KEY:
        return None

    content = content[:4000]
    content_prompts = _PROMPTS.get("content_prompts", {})
    prompt = content_prompts.get("quiz", "").replace("{content}", content).replace("{count}", str(count))

    data = await _chat(
        [{"role": "user", "content": prompt}],
        max_tokens=2048,
        response_format={"type": "json_object"},
    )
    if data:
        try:
            raw_content = data["choices"][0]["message"]["content"]
            return json.loads(raw_content)
        except Exception:
            pass
    return None

async def generate_flashcards(content: str, count: int = 8):
    if not GROQ_API_KEY:
        return None

    content = content[:4000]
    content_prompts = _PROMPTS.get("content_prompts", {})
    prompt = content_prompts.get("flashcards", "").replace("{content}", content).replace("{count}", str(count))

    data = await _chat(
        [{"role": "user", "content": prompt}],
        max_tokens=2048,
        response_format={"type": "json_object"},
    )
    if data:
        try:
            raw_content = data["choices"][0]["message"]["content"]
            result = json.loads(raw_content)
            if isinstance(result, dict):
                for key in result:
                    if isinstance(result[key], list):
                        return result[key]
            return result
        except Exception:
            pass
    return None

async def summarize_youtube_video(transcript: str):
    if not GROQ_API_KEY:
        return "AI Summarization unavailable."

    content_prompts = _PROMPTS.get("content_prompts", {})
    prompt = content_prompts.get("youtube_summary", "").replace("{transcript}", transcript[:8000])

    data = await _chat(
        [{"role": "user", "content": prompt}],
        max_tokens=1500,
    )
    if data:
        try:
            return data["choices"][0]["message"]["content"]
        except Exception:
            pass
    return "Failed to generate summary."
