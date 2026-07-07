<p align="center">
  <img src="Logo.png" alt="StudyFlow AI" width="180"/>
</p>

<h1 align="center">StudyFlow AI</h1>

<p align="center">
  <b>Intelligent Collaborative Learning Platform</b><br>
  An AI-powered study workspace with real-time collaboration, smart tutoring, and content generation.
</p>

<p align="center">
  <a href="https://github.com/anomalyco/StudyFlow-AI">
    <img src="https://img.shields.io/badge/GitHub-Repository-181717?logo=github&logoColor=white" alt="GitHub">
  </a>
  <img src="https://img.shields.io/badge/Next.js_15-000000?logo=next.js&logoColor=white" alt="Next.js 15">
  <img src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white" alt="MongoDB">
  <img src="https://img.shields.io/badge/Groq-FF6600?logo=groq&logoColor=white" alt="Groq">
  <img src="https://img.shields.io/badge/Socket.IO-010101?logo=socketdotio&logoColor=white" alt="Socket.IO">
  <img src="https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License MIT">
</p>

---

## What It Is

StudyFlow AI is a full-stack collaborative study platform where students can:

- Chat with an **AI tutor** that adapts to your learning style (6 personas)
- **Collaborate in real-time** with classmates via shared workspaces
- **Upload documents** and let the AI answer questions from your own materials
- **Generate quizzes, flashcards, and podcasts** from your study content
- **Turn YouTube videos** into structured study notes
- **Export everything** as beautifully formatted PDFs

Designed and developed from scratch with Next.js 15, FastAPI, MongoDB, and Groq's LLM API. Designed as a portfolio project to demonstrate full-stack development, AI integration, real-time systems, and modern UI/UX design.

---

## Screenshots

<p align="center">
  📄 <a href="showcase/Full%20UI%20ScreenShot.pdf"><b>View Full App Screenshot →</b></a>
  <br>
  <em>Full application interface — AI chat, document sidebar, and study tools</em>
</p>

| Feature | Preview |
|---|---|
| **Chat Landing** | <img src="showcase/Chat%20Landing.png" alt="Chat Landing" width="100%"/> |
| **Group Chat Collaboration** | <img src="showcase/GroupChat%20UI.png" alt="Group Chat" width="100%"/> |
| **Quiz Interface** | <img src="showcase/Quiz/Quiz%20UI.png" alt="Quiz" width="100%"/> |
| **Flashcard Questions** | <img src="showcase/Flashcards/FlashCards%20Question%20UI.png" alt="Flashcard Question" width="100%"/> |
| **Flashcard Answers** | <img src="showcase/Flashcards/FlashCards%20Answer%20UI.png" alt="Flashcard Answer" width="100%"/> |
| **YouTube → Study Notes** | <img src="showcase/YouTube%20Summary%20UI.png" alt="YouTube Summary" width="100%"/> |
| | Summarized from [this video](https://www.youtube.com/watch?v=T-D1OfcDW1M) — paste any YouTube URL, the AI fetches the transcript via YouTube Transcript API, then Groq structures it into organized study notes with headings, core concepts, key takeaways, and a summary paragraph. [View full output →](showcase/YouTube%20Summary%20(T-D1OfcDW1M).md) |

---

## Features

### 🤖 AI Tutoring System

An intelligent tutor powered by **Llama 4 Scout 17B** via Groq's high-speed inference API — 30,000 tokens per minute on the free tier.

The AI goes through a **16-module pipeline** to understand you before responding:

| Module | What It Does | Why It Matters |
|---|---|---|
| **Intent Detection** | Classifies your message into 7 intents (Learn, Practice, Debug, Search, etc.) in ~2ms | The AI knows if you want a deep explanation vs a quick answer |
| **Emotion Detection** | Detects 7 emotions (Curious, Confused, Frustrated, etc.) in ~1ms | A frustrated student gets encouragement; a curious one gets deeper exploration |
| **6 Teaching Personas** | Switches between Professor, Code Coach, Socratic Guide, Exam Coach, Peer Mentor, and Casual Tutor | No one-size-fits-all — the AI matches your preferred teaching style |
| **User Memory** | Loads your learning profile from MongoDB | Remembers your strengths, weaknesses, and past questions |
| **Adaptive RAG** | Retrieves relevant chunks from your uploaded documents | Answers are grounded in YOUR materials, not generic internet knowledge |
| **Self-Reflection** | Second LLM call critiques and improves the response before sending | Catches factual errors and unclear explanations automatically |
| **Code Execution** | Sandboxed Python/JavaScript in the chat | Write, run, and debug code without leaving the conversation |
| **Tool Calling** | AI can search the web, generate quizzes, create flashcards, summarize YouTube videos | The tutor takes actions, not just talks |
| **Response Length** | 6 levels from ultra-short (voice-friendly) to comprehensive (textbook-style) | Adapts to context — quick answers or deep dives |

> **Why this matters:** Most AI tutors just answer questions. StudyFlow AI adapts its entire teaching approach based on who you are, how you're feeling, and what you're trying to learn — all automatically.

---

### 👥 Collaborative Workspaces

Study with friends, classmates, or study groups. Every feature works in real-time.

| Feature | How It Works | Use Case |
|---|---|---|
| **Create Workspaces** | Name, describe, and organize your workspace | Separate workspaces for Physics, Math, Coding — or one for each study group |
| **Group Chat** | Real-time member chat via Socket.IO | Discuss concepts, share notes, ask each other questions — all in one place |
| **Invite with Codes** | Owner generates a 6-character join code (auto-expires after 5 minutes) | No account sharing, no emails — just share the code in class |
| **Member Roles** | Owner and Editor roles | Owner controls the workspace; members collaborate freely |
| **AI Permission Toggle** | Owner can enable/disable AI access per member | Keep study sessions focused or limit AI access for certain members |
| **Delete / Kick / Leave** | Owner deletes workspace, kicks members; members leave voluntarily | Maintain a healthy, focused study group |
| **Real-Time Events** | Socket.IO broadcasts messages, invites, kicks instantly | Everyone sees updates without refreshing |

> **Why this matters:** Studying alone is hard. StudyFlow AI makes collaboration effortless — invite anyone with a code, chat in real-time, and share AI-generated study content with your group.

---

### 📚 Document Management

Upload your study materials and let the AI use them as context.

| Feature | How It Works | Why It Matters |
|---|---|---|
| **Upload PDF / DOCX / TXT** | Files stored in MongoDB GridFS with extracted text | Keep all materials in one place |
| **Automatic Text Extraction** | PyMuPDF for PDFs, python-docx for DOCX | The AI reads your documents directly — no manual copying |
| **OCR for Scanned PDFs** | EasyOCR with GPU acceleration across pages | Even scanned textbooks become searchable, AI-usable content |
| **Document Preview** | Full-screen modal renders extracted text as markdown | Read without leaving the chat interface |
| **RAG from Documents** | AI retrieves relevant passages when answering | Answers are based on YOUR specific study materials |
| **File Management** | View, preview, and delete files from the sidebar | Everything organized in one place |

> **Why this matters:** The AI isn't limited to its training data. Upload your textbook, lecture notes, or study guides — and the AI answers directly from YOUR materials.

---

### 🎓 AI-Generated Study Content

Transform your chat history and documents into interactive study materials.

| Feature | How It Works | Why It Matters |
|---|---|---|
| **Quiz Generation** | AI creates multiple-choice questions with 4 options, correct answer, and explanation | Test your understanding instantly — assessments written from your own materials |
| **Flashcard Generation** | AI creates front/back study cards with mastery tracking (0-5 scale) | Active recall practice — proven to improve long-term retention |
| **Podcast Generation** | Two-voice dialogue (Professor Guy + Student Ava) generated as a 20+ exchange script, synthesized to MP3 via Edge-TTS | Turn study notes into audio lessons — learn while commuting, exercising, or doing chores |
| **Selective Generation** | Pick specific chat messages to include in your podcast | Choose exactly what topics to review |

> 🎧 **[Listen to Sample Podcast →](showcase/Podcast.mp3)**
> *Two voices, 16+ exchanges, natural dialogue with analogies and emotions. Click to play or download.*

> **Why this matters:** Reading notes is passive. Quizzes test understanding, flashcards build memory, and podcasts let you learn on the go. Three different formats for three different ways of learning.

---

### 🎤 Voice & Audio Features

Full voice interaction pipeline for hands-free studying.

| Feature | How It Works | Why It Matters |
|---|---|---|
| **Speech-to-Text** | OpenAI Whisper API, Google Speech Recognition as fallback | Speak your questions naturally — no typing required |
| **AI Voice Response** | Response cleaned and synthesized via Edge-TTS | Hear the AI tutor speak back in a natural voice |
| **Call Mode** | Full voice-call overlay: record → transcribe → AI processes → TTS plays back | Like a real tutoring call — ideal for complex discussions |
| **Podcast Player** | Custom audio player with play/pause, seek, volume, speed control | Listen at your own pace |

---

### 📺 YouTube Integration

Turn any educational YouTube video into structured study notes in one click.

| Feature | How It Works | Why It Matters |
|---|---|---|
| **Universal URL Parsing** | All formats: watch?v=, youtu.be/, embed/, shorts/ | Paste any link — it works |
| **Transcript Extraction** | Fetches captions via YouTube Transcript API | No manual note-taking |
| **AI Summarization** | Groq summarizes into structured notes with core concepts, key takeaways, and a summary | Get the essence of a 20-minute video in 2 minutes |
| **Virtual Document** | Saved in your workspace document list | Revisit any summary later from the sidebar |

---

### 📐 Interactive Diagrams

The AI generates multiple types of diagrams to visualize complex concepts.

| Diagram Type | Technology | What It Visualizes |
|---|---|---|
| **D2 Diagrams** | `@terrastruct/d2` compiled to SVG | Architecture diagrams, flowcharts, system designs |
| **Premium Node-Edge** | `@xyflow/react` + ELK auto-layout | Neural networks, knowledge graphs (interactive pan/zoom) |
| **Memory Layout** | Custom React component | Python/C memory internals — pointer arrays, buffer views, hex addresses |
| **Mermaid Diagrams** | Markdown code blocks | Sequence diagrams, state diagrams, mind maps |

---

### 📥 PDF Export

Download everything as professionally styled dark-theme PDFs.

| Export | What It Captures | Why It Matters |
|---|---|---|
| **Chat Export** | Full conversation with markdown, diagrams as images, sources, thinking traces | Save tutoring sessions as revision notes |
| **Quiz Export** | Questions, options, correct answers, explanations, score | Print for offline practice |
| **Flashcard Export** | All cards with front (question) and back (answer) side-by-side | Physical study cards without rewriting |

---

### 🧠 The AI Pipeline (16 Modules)

```
User Message
    ↓
[Intent Analyzer]       → 7 intents (Learn, Practice, Debug, Search…)        ~2ms
[Emotion Analyzer]      → 7 emotions (Curious, Confused, Frustrated…)       ~1ms
[User Memory]           → Load learning profile from MongoDB
[Learning Progress]     → Track mastery per topic
[Knowledge Retriever]   → Adaptive RAG + optional web search
[Agent Router]          → Pick teaching persona ← intent + emotion + mastery
[Response Planner]      → Decide length, style, content flags, tools
[Prompt Builder]        → Assemble LLM prompt from YAML templates
[LLM Gateway]           → Single external call to Groq (Llama 4 Scout 17B)
[Self-Reflection]       → Optional: critique + improve own response
[Tool Registry]         → LLM can call web_search, quiz, flashcards, YouTube
[Code Executor]         → Sandboxed Python/JS if DEBUG intent
[Response Validator]    → Check for truncation, garbage, safety
[UI Formatter]          → Extract reasoning, fix markdown, close tags
    ↓
Formatted Response
```

All 16 modules run asynchronously with per-phase latency tracking.

### 🔍 Web Search (3-Tier Cascade)

The AI can search the web in real-time via the `web_search` tool. The `SearchService` tries three backends in sequence:

| Tier | Backend | Method |
|------|---------|--------|
| 1st | **Bing** | HTML scrape of `bing.com/search` via BeautifulSoup |
| 2nd | **DuckDuckGo Lite** | POST to `lite.duckduckgo.com/lite` (lightweight, least likely to block) |
| 3rd | **DuckDuckGo HTML** | GET `html.duckduckgo.com/html` with `uddg` URL unwrapping |

- **User-Agent rotation**: Randomly picks from 4 browser UA strings per request to avoid fingerprinting
- **0.3s delay** between tiers to appear human-like
- **Rate limiting**: After 3 consecutive failures across all tiers, backs off `min(60 × failures, 600)` seconds
- All parsing uses BeautifulSoup with no API keys needed — purely organic scraping

Results (title + URL + snippet, up to 5) are returned to the LLM to incorporate into its response.

### 🔁 Retry Logic

Failed operations don't fail silently — the system retries with escalating waits:

| Operation | Retries | Wait Pattern | Notes |
|-----------|---------|-------------|-------|
| **Podcast generation** | 3 API calls | `[5s, 10s, 15s]` asyncio.sleep | Also recursively re-generates if the returned script has <20 exchanges (max 2 recursion depth) |
| **Web search** | 6 attempts (3 tiers × retry on empty) | 0.3s between tiers, then exponential backoff `60–600s` after 3 consecutive total failures | Rotates through Bing → DDG Lite → DDG HTML |

The base `_chat()` helper (Groq API call) does **not** retry — retries are handled at the caller level so each operation can choose its own backoff strategy.

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | 15.1.0 | React framework with App Router |
| **React** | 19.0.0 | UI library |
| **TypeScript** | 5 | Type safety |
| **Tailwind CSS** | 4 | Utility-first styling with dark theme |
| **Framer Motion** | 12.40.0 | Animations and transitions |
| **Socket.IO Client** | 4.8.3 | Real-time WebSocket communication |
| **ReactFlow (@xyflow/react)** | 12.11.0 | Interactive node-edge diagrams |
| **D2 (@terrastruct/d2)** | 0.1.33 | Diagram compiler |
| **html2canvas + jsPDF** | — | PDF export (canvas capture + page generation) |
| **React-Markdown** | 10.1.0 | Markdown rendering |
| **Lucide React** | 1.17.0 | Icons |
| **date-fns** | 4.4.0 | Date formatting |

### Backend

| Technology | Purpose |
|---|---|
| **FastAPI** | Async Python web framework |
| **Motor** (async MongoDB) | Database access |
| **Authlib** | Google OAuth 2.0 |
| **httpx** | Async HTTP client for AI API calls |
| **PyMuPDF / python-docx** | Document text extraction |
| **EasyOCR** | GPU-accelerated OCR |
| **Edge-TTS** | Microsoft neural text-to-speech |
| **PyDub** | Audio processing |
| **python-socketio** | Socket.IO server |
| **PyYAML** | Prompt configuration |

### AI & External APIs

| Service | Use |
|---|---|
| **Groq API** | LLM inference (Meta Llama 4 Scout 17B — 30K TPM free tier) |
| **OpenAI Whisper** | Speech-to-text |
| **Google Speech Recognition** | STT fallback |
| **Edge-TTS (Microsoft)** | Neural TTS |
| **YouTube Transcript API** | Caption extraction |
| **DuckDuckGo / Bing** | Web search |

### Database (MongoDB)

| Collection | Stores |
|---|---|
| `users` | Account info |
| `workspaces` | Workspace metadata, join codes |
| `workspace_members` | Membership records with roles |
| `chat_messages` | AI tutoring conversation history |
| `member_messages` | Group chat messages |
| `documents` | Uploaded documents + extracted text |
| `quizzes` | Generated quiz questions |
| `flashcards` | Flashcards with mastery levels |
| `user_profiles` | Learning preferences |
| `learning_progress` | Topic mastery tracking |

---

## Why meta-llama/llama-4-scout-17b-16e-instruct?

Groq offers free-tier access to high-speed LLM inference with this model at **30,000 tokens per minute** — more than enough for:

- Podcast generation (~9K tokens per episode)
- Chat tutoring
- Quiz and flashcard generation
- YouTube summarization

**What paid models (Claude, GPT, etc.) offer:**

- Higher reasoning quality for complex topics
- Vision support (image analysis)
- Larger context windows

**The trade-off:** Free models handle 95% of study tasks well. For image analysis or extremely complex reasoning, switching to a paid model improves quality but adds cost.

---

## Project Structure

```
StudyFlow-AI/
├── README.md
├── .gitignore
├── .env                          # Gitignored — API keys
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/     # 6 route files (auth, chat, workspaces, docs, educational, ai)
│   │   ├── core/                 # MongoDB, Socket.IO
│   │   ├── pipeline/             # 16 AI pipeline modules
│   │   ├── services/             # AI, document, podcast, search, STT, YouTube
│   │   ├── schemas/              # Pydantic models
│   │   └── utils/                # Helpers
│   ├── prompts.yaml              # Gitignored — real AI prompts
│   ├── prompts.example.yaml      # Template for prompts
│   ├── requirements.txt
│   └── run.py                    # Entry point
└── frontend/
    ├── app/                      # Pages: login, chat
    ├── components/
    │   ├── auth/                 # AuthGuard
    │   └── chat/                 # 17 components (sidebar, bubbles, quiz, flashcards, etc.)
    ├── context/                  # Socket.IO provider
    ├── services/                 # API client
    └── package.json
```

---

## Setup

### Prerequisites

- Python 3.9+
- Node.js 18+
- MongoDB (local or [Atlas](https://www.mongodb.com/atlas) — free tier works)
- Groq API key — free at [console.groq.com](https://console.groq.com)
- Google OAuth credentials — free at [console.cloud.google.com](https://console.cloud.google.com)

### 1. Backend Setup

```bash
cd backend
python -m venv .venv

# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Configure Environment

Create `backend/.env` (never commit this):

```env
GROQ_API_KEY=gsk_your_key_here
MONGODB_URI=mongodb://localhost:27017
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
```

### 3. Start Backend

```bash
python run.py
# → http://localhost:8000
```

### 4. Frontend Setup

```bash
cd frontend
npm install
```

No `.env.local` needed — all API keys and OAuth are handled by the backend.

### 5. Start Frontend

```bash
npm run dev
# → http://localhost:3000
```

Open `http://localhost:3000`, sign in with Google — you're in.

---

## Why I Built This

> This project was built as my **BCA Portfolio Project** to demonstrate my skills in full-stack development, AI integration, real-time collaboration, and modern software engineering. 

From designing the 16-module AI pipeline to building the real-time collaboration layer, this project covers the full stack — frontend, backend, AI, and infrastructure — end to end.

| Skill | Demonstrated In |
|---|---|
| **Full-Stack Development** | Next.js 15 (React 19) + FastAPI — both built from scratch |
| **AI/LLM Integration** | Groq API with prompt chaining, tool calling, self-reflection, adaptive RAG — a 16-module AI pipeline |
| **Real-Time Systems** | Socket.IO for chat, workspace invites, member events, and live collaboration |
| **Database Design** | MongoDB with 13 collections, GridFS file storage, async access patterns |
| **Authentication** | Google OAuth 2.0 with token exchange, route guards, session management |
| **Document Processing** | PDF/DOCX/TXT extraction, GPU-accelerated OCR for scanned documents |
| **Audio Processing** | Speech-to-text (Whisper), neural TTS (Edge-TTS), audio concatenation (PyDub) |
| **UI/UX Design** | Dark theme with glass-morphism, Tailwind CSS 4, Framer Motion animations, responsive layout |
| **System Architecture** | 16-module AI pipeline, service-oriented backend (6 services), component-based frontend (17 components) |
| **API Design** | 25+ REST endpoints, typed request/response models, dependency injection, error handling |

---

## See It In Action

Explore the actual output files generated by StudyFlow AI:

| Feature | Demo File |
|---|---|
| **AI Chat (RAG & Prompt Engineering)** | [`showcase/RAG & Prompt Engineering Chat Conversation.pdf`](showcase/RAG%20%26%20Prompt%20Engineering%20Chat%20Conversation.pdf) |
| **YouTube → Study Notes** | [`showcase/YouTube Summary (T-D1OfcDW1M).md`](showcase/YouTube%20Summary%20(T-D1OfcDW1M).md) |
| **Generated Podcast (MP3)** | [`showcase/Podcast.mp3`](showcase/Podcast.mp3) |
| **Quiz Export (PDF)** | [`showcase/Quiz/quiz.pdf`](showcase/Quiz/quiz.pdf) |
| **Flashcard Export (PDF)** | [`showcase/Flashcards/flashcards.pdf`](showcase/Flashcards/flashcards.pdf) |

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

**Notes:**

- This project is released as a portfolio / educational demonstration.
- External API keys (Groq, Google OAuth, etc.) are not included and must be provided by the user.
- Third-party services (Groq, Microsoft Edge-TTS, YouTube Transcript API, etc.) have their own terms of service.
- The software is provided without warranty — see the full license above.
