# 🍈 Melon Web App

> CSC10011 PA2 — AI-powered learning platform for kids (K–8)
> Built with Next.js 16 + TypeScript + Tailwind CSS v4 + Neobrutalism design system

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS v4, Neobrutalism design system (AISE palette) |
| UI Components | shadcn/ui (Radix UI), Framer Motion |
| Auth | Firebase Authentication |
| AI / Chat | OpenAI GPT-4o-mini (SSE streaming) |
| TTS | ElevenLabs |
| RAG | OpenAI Embeddings + Pinecone |
| State | TanStack Query v5, localStorage (mock Phase 1) |
| Charts | Recharts |
| Deployment | Vercel (one-click deploy) |

---

## Project Structure

```
melon-web/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Landing page
│   ├── lessons/            # Lesson grid + player
│   ├── progress/           # Kid progress dashboard
│   ├── parent/             # Parent dashboard (charts)
│   ├── badges/             # Badge cabinet
│   ├── leaderboard/        # Leaderboard
│   ├── profile/            # Kid profile editor
│   ├── family/             # Parent → child link management
│   ├── admin/              # Admin dashboard + content moderation
│   └── api/v1/             # Route Handlers (AI, RAG)
├── components/
│   ├── ai/                 # AITutorWidget (Cosmo)
│   ├── auth/               # AuthModal (2-step login/signup)
│   ├── layout/             # NavHeader, KidShell, ParentShell, AdminShell
│   ├── lessons/            # LessonCard
│   ├── shared/             # NbButton, NbPill, SectionHeader, StatCard, XPBar …
│   └── ui/                 # shadcn/ui primitives
├── lib/
│   ├── auth/               # Firebase auth context + hooks
│   ├── core/               # config, query-client, event-bus, error-handler, providers
│   ├── gamification/       # XP / badge store (localStorage)
│   ├── lessons/            # Mock lesson data
│   └── user/               # User profile store (localStorage)
├── design-system/
│   └── melon-app/MASTER.md # Design system source of truth
├── plans/                  # Architecture decision records + project plan
├── infra/main.tf           # Terraform stub (Phase 2)
└── Dockerfile
```

---

## Quick Start

### 1. Clone & install

```bash
git clone <repo-url>
cd melon-web
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
# Fill in at minimum NEXT_PUBLIC_FIREBASE_* to enable login
# All other keys are optional for local dev (AI features will be disabled)
```

### 3. Run dev server

```bash
npm run dev
# → http://localhost:3000
```

---

## Environment Variables

Copy `.env.example` → `.env.local`:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Auth only | Firebase project API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Auth only | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Auth only | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Auth only | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Auth only | Firebase sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Auth only | Firebase app ID |
| `OPENAI_API_KEY` | AI features | OpenAI API key (chat, RAG, moderation) |
| `PINECONE_API_KEY` | RAG only | Pinecone vector DB key |
| `PINECONE_INDEX` | RAG only | Pinecone index name (default: `melon-lessons`) |
| `ELEVENLABS_API_KEY` | TTS only | ElevenLabs API key |
| `ELEVENLABS_VOICE_ID` | TTS only | Voice ID (default: Rachel) |

> **Without any keys:** The app runs in demo mode — all pages work with mock data via localStorage.

---

## Pages & Features

### No keys needed (demo mode)
| Route | Description |
|---|---|
| `/` | Landing page |
| `/lessons` | Lesson grid with subject filter |
| `/lessons/[id]` | Lesson player (slides + quiz, Framer Motion) |
| `/progress` | XP bar, badges, activity history |
| `/badges` | Badge cabinet |
| `/leaderboard` | Leaderboard with podium |
| `/profile` | Kid profile editor (name, grade, avatar) |
| `/parent` | Parent dashboard with Recharts |
| `/admin` | Admin overview + content moderation |
| `/admin/lessons` | Lesson management |
| `/admin/flagged` | Flagged content review |

### Requires Firebase keys
| Route | Description |
|---|---|
| Login / Signup modal | Email/password + Google SSO |
| `/family` | Link parent → child accounts |

### Requires OpenAI key
| Feature | Description |
|---|---|
| AI Tutor (Cosmo) | Streaming chat widget on lesson pages |
| RAG quiz | Generate questions from uploaded PDFs |
| Content moderation | Auto-flag inappropriate content |

### Requires Pinecone + OpenAI
| Route | Description |
|---|---|
| `/admin/pdf-upload` | Upload PDFs for vector ingestion |

---

## Scripts

```bash
npm run dev      # Start dev server (Turbopack)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

---

## Development Notes

- **Mock data**: All lessons, XP, badges, and leaderboard data are in `lib/lessons/mock-lessons.ts` and `lib/gamification/gamification-store.ts`
- **Adding lessons**: Edit `MOCK_LESSONS` array in `lib/lessons/mock-lessons.ts`
- **Design system**: All tokens defined in `app/globals.css` under `@theme inline` — see `design-system/melon-app/MASTER.md` for guidelines
- **API routes**: All backend logic lives under `app/api/v1/` as Next.js Route Handlers
- **Phase 2**: Real backend integration, deploy via Vercel (`infra/vercel.json`)

---

## Contributing

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Commit with conventional commits: `git commit -m "feat: add quiz timer"`
3. Open a pull request against `main`

> **Never commit `.env.local`** — it is gitignored. Share keys via team password manager.
