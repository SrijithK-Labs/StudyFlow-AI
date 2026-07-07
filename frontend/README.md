# StudyFlow AI — Frontend

Next.js 15 (React 19) frontend with Tailwind CSS 4, Socket.IO real-time, and AI-powered study tools.

## Setup

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

No `.env.local` needed — Google OAuth is handled entirely by the backend.

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout with dark theme
│   ├── page.tsx                # Landing page → login
│   ├── login/page.tsx          # Google OAuth login
│   └── chat/page.tsx           # Main workspace + AI chat
├── components/chat/
│   ├── ChatSidebar.tsx         # Documents, quizzes, flashcards tabs
│   ├── ChatBubble.tsx          # Message renderer (markdown, diagrams, code)
│   ├── ChatInput.tsx           # Text + voice input bar
│   ├── ChatHeader.tsx          # Workspace info + invite/members buttons
│   ├── Typewriter.tsx          # Streaming text animation
│   ├── DateSeparator.tsx       # Conversation date markers
│   ├── CallModeOverlay.tsx     # Full-screen voice call interface
│   ├── QuizView.tsx            # Interactive quiz with timer + PDF export
│   ├── FlashcardView.tsx       # Spaced repetition flashcards + PDF export
│   ├── PodcastPlayer.tsx       # Audio player for generated podcasts
│   ├── D2Diagram.tsx           # Renders D2-compiled SVG diagrams
│   ├── PremiumDiagram.tsx      # Interactive ReactFlow node-edge diagrams
│   ├── MemoryLayoutDiagram.tsx # Python/C memory visualization
│   ├── DocumentPreview.tsx     # Full-screen document text viewer
│   ├── InviteModal.tsx         # Generate join code (owner)
│   ├── JoinModal.tsx           # Enter join code (member)
│   └── MembersModal.tsx        # Manage members: kick, toggle AI, change role
├── context/
│   └── SocketContext.tsx       # Socket.IO provider for real-time events
├── services/
│   └── api.ts                  # HTTP client for all backend endpoints
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── tsconfig.json
└── package.json
```

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **UI Library:** React 19, Tailwind CSS 4, Framer Motion 12
- **Diagrams:** `@terrastruct/d2`, `@xyflow/react` (ReactFlow) + ELK layout
- **PDF Export:** html2canvas + jsPDF (chat); html2pdf.js (quizzes, flashcards)
- **Markdown:** react-markdown 10, remark-gfm, rehype-raw, rehype-highlight
- **Marked:** Client-side markdown parsing for PDF generation
- **Icons:** lucide-react
- **Realtime:** socket.io-client
- **Animations:** Framer Motion
- **Auth:** Google OAuth (handled by backend)

## Key Endpoints (from the backend this talks to)

See `backend/README.md` for the full API reference.

## Environment Variables

No environment variables required in the frontend — all API keys and OAuth are handled by the backend.

## Build

```bash
npm run build
npm start
```

## Why Webpack over Turbopack?

Next.js 15 ships with Turbopack as an opt-in dev server (`next dev --turbopack`), but this project uses the default **webpack** bundler for two reasons:

1. **Library compatibility** — `@terrastruct/d2` (diagram compiler) and `@xyflow/react` (interactive node-edge diagrams) rely on Node.js APIs and worker threads that Turbopack doesn't fully support yet. Turbopack's module resolution differs from webpack, which causes runtime errors with these packages.

2. **Stability** — Turbopack is still in active development. Webpack is battle-tested and ensures consistent builds across environments, which matters when deploying to production or sharing the repo with others.

If Turbopack matures and resolves these compatibility issues, switching is a one-line change in `package.json`:
```json
"dev": "next dev --turbopack"
```
