# StudyFlow AI — Backend

FastAPI backend with Motor async MongoDB, Groq LLM integration, Socket.IO real-time, document processing, and podcast generation.

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows — or source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt

# Create .env with your keys (gitignored):
cp .env.example .env
# Then edit .env with your actual credentials

python run.py
# → http://localhost:8000
```

## Project Structure

```
backend/
├── app/
│   ├── api/v1/endpoints/
│   │   ├── auth.py            # Google OAuth login + callback + current user
│   │   ├── chat.py            # AI chat: send message (with tools, code, agents)
│   │   ├── ai.py              # Active model info, voice TTS, YouTube summary
│   │   ├── documents.py       # Upload, list, preview, delete PDF/DOCX/TXT
│   │   ├── educational.py     # Generate/submit quizzes, flashcards
│   │   └── workspaces.py      # CRUD workspaces, invite codes, members, roles
│   ├── core/
│   │   ├── mongodb.py         # Motor async MongoDB driver
│   │   └── socket_manager.py  # Socket.IO server + event handlers
│   ├── pipeline/              # 16-module AI pipeline
│   │   ├── orchestrator.py         # Main pipeline runner
│   │   ├── intent_analyzer.py      # 7 intents (Learn, Practice, Debug, …)
│   │   ├── emotion_analyzer.py     # 7 emotions (Curious, Confused, …)
│   │   ├── user_memory.py          # Conversation history loader
│   │   ├── learning_progress.py    # Topic mastery tracker
│   │   ├── knowledge_retriever.py  # Adaptive RAG (2-5 chunks based on complexity)
│   │   ├── agent_router.py         # 6 teaching personas (Professor, Code Coach, …)
│   │   ├── response_planner.py     # Length, style, content flags, tool selection
│   │   ├── prompt_builder.py       # Assembles LLM prompt from prompts.yaml
│   │   ├── llm_gateway.py          # Groq API call (Llama 4 Scout 17B)
│   │   ├── self_reflector.py       # Second LLM call: critique + improve
│   │   ├── tool_registry.py        # web_search, quiz, flashcards, YouTube
│   │   ├── code_executor.py        # Sandboxed Python/JavaScript
│   │   ├── response_validator.py   # Truncation, garbage, safety checks
│   │   ├── ui_formatter.py         # Extract reasoning, fix markdown, close tags
│   │   └── monitor.py              # Per-phase latency, token tracking
│   ├── services/
│   │   ├── ai_service.py           # Chat helper + podcast generation with retries
│   │   ├── document_service.py     # Parse PDF (PyMuPDF), DOCX, TXT; OCR via EasyOCR
│   │   ├── podcast_service.py      # Edge-TTS voice synthesis (Davis + Jenny), stutter guard, 4-voice fallback
│   │   ├── search_service.py       # DuckDuckGo web search
│   │   ├── stt_service.py          # OpenAI Whisper + Google STT fallback
│   │   └── youtube_service.py      # YouTube transcript extraction + summarization
│   ├── schemas/                    # Pydantic request/response models
│   ├── utils/                      # Shared helpers
│   └── main.py                     # FastAPI app factory + event handlers
├── static/                         # Static files (podcast audio output)
├── prompts.yaml                    # All AI prompts (gitignored)
├── prompts.example.yaml            # Placeholder template for reference
├── requirements.txt
├── run.py                          # uvicorn entry point
└── .env                            # GROQ_API_KEY, MongoDB URI, Google OAuth (gitignored)
```

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/auth/login` | Google OAuth redirect |
| GET | `/api/v1/auth/callback` | Google OAuth token exchange |
| GET | `/api/v1/auth/me` | Current user profile |

### Chat
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/chat/{workspace_id}` | Send message (returns AI response, tools used, code results) |
| GET | `/api/v1/chat/{workspace_id}` | Get conversation history |
| POST | `/api/v1/chat/{workspace_id}/selective-podcast` | Generate podcast from selected messages |
| POST | `/api/v1/chat/{workspace_id}/test-tts` | Test TTS with custom text |

### Documents
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/documents/{workspace_id}/upload` | Upload PDF/DOCX/TXT (to GridFS) |
| GET | `/api/v1/documents/{workspace_id}` | List workspace documents |
| GET | `/api/v1/documents/{workspace_id}/{doc_id}` | Get extracted text |
| POST | `/api/v1/documents/{workspace_id}/delete/{doc_id}` | Delete document |

### Workspaces
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/workspaces` | Create workspace |
| GET | `/api/v1/workspaces` | List user's workspaces |
| GET | `/api/v1/workspaces/{workspace_id}` | Get workspace details |
| PUT | `/api/v1/workspaces/{workspace_id}` | Update workspace settings |
| DELETE | `/api/v1/workspaces/{workspace_id}` | Delete workspace (owner only) |
| POST | `/api/v1/workspaces/{workspace_id}/generate-code` | Generate 6-char join code (owner only, expires 5 min) |
| POST | `/api/v1/workspaces/join` | Join workspace via code |
| POST | `/api/v1/workspaces/{workspace_id}/members/{user_id}/toggle-ai` | Toggle AI permissions (owner only) |
| DELETE | `/api/v1/workspaces/{workspace_id}/members/{user_id}` | Kick member (owner only) |
| POST | `/api/v1/workspaces/{workspace_id}/leave` | Leave workspace voluntarily |

### Educational
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/educational/generate-quiz` | Generate multiple-choice quiz |
| POST | `/api/v1/educational/generate-flashcards` | Generate flashcards |
| PUT | `/api/v1/educational/flashcards/{card_id}/mastery` | Update flashcard mastery level |
| POST | `/api/v1/educational/submit-quiz-attempt` | Submit quiz and get score |
| GET | `/api/v1/educational/flashcards` | Get all flashcards for workspace |
| GET | `/api/v1/educational/quizzes` | Get all quizzes for workspace |

### AI
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/ai/model` | Get active model name + display name |
| POST | `/api/v1/voice/record` | Speech-to-text (multipart audio file) |
| POST | `/api/v1/voice/test` | Test TTS (multipart with text) |
| POST | `/api/v1/youtube/summarize` | Fetch transcript + AI summary |

## Socket.IO Events

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `join_workspace` | Client→Server | `{ workspace_id }` | Subscribe to workspace room |
| `new_message` | Server→Client | `{ message }` | New AI chat message |
| `group_message` | Server→Client | `{ message }` | New member-to-member message |
| `workspace_invite` | Server→Client | `{ code, workspace_id }` | Notify member of invite code |
| `member_joined` | Server→Client | `{ user, workspace_id }` | New member arrived |
| `member_kicked` | Server→Client | `{ user_id }` | You were removed from workspace |
| `member_left` | Server→Client | `{ user_id }` | Member left voluntarily |
| `workspace_deleted` | Server→Client | `{ workspace_id }` | Workspace was deleted by owner |
| `ai_toggled` | Server→Client | `{ user_id, enabled }` | AI permission changed |

## AI Pipeline (16 Modules)

All modules in `app/pipeline/` run asynchronously per message:

1. **Intent Analyzer** — 7 intents (Learn, Practice, Debug, Search, etc.)
2. **Emotion Analyzer** — 7 emotions (Curious, Confused, Frustrated, etc.)
3. **User Memory** — Load conversation history from MongoDB
4. **Learning Progress** — Track topic mastery per user
5. **Knowledge Retriever** — Adaptive RAG (2-5 chunks) + optional web search
6. **Agent Router** — Pick persona: Professor, Code Coach, Socratic Guide, Exam Coach, Peer Mentor, Casual Tutor
7. **Response Planner** — Decide length (6 levels), style, content flags, tools
8. **Prompt Builder** — Assemble structured prompt from `prompts.yaml` templates
9. **LLM Gateway** — Single call to Groq (Meta Llama 4 Scout 17B — 30K TPM)
10. **Self-Reflection** — Optional second call critiquing and improving the response
11. **Tool Registry** — LLM can call `web_search`, `generate_quiz`, `generate_flashcards`, `summarize_youtube`
12. **Code Executor** — Sandboxed Python/JavaScript (AST validation, 5s timeout, 1MB limit)
13. **Response Validator** — Check for truncation, garbage, safety violations
14. **UI Formatter** — Extract reasoning, fix markdown, close unclosed tags
15. **Monitor** — Per-phase latency, token tracking, error logging

## Prompt System

All prompts live in `prompts.yaml` (gitignored). A `prompts.example.yaml` with placeholder text is tracked for reference.

