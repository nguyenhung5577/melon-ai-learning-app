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
| Database | **Firestore** (Real-time data persistence) |
| Auth | Firebase Authentication |
| Storage | **Cloudinary** (Optimized PDF & Avatar hosting) |
| AI / Chat | OpenAI GPT-4o-mini (SSE streaming) |
| TTS | ElevenLabs |
| RAG | OpenAI Embeddings + Pinecone |
| State | TanStack Query v5, Firestore + userStore |
| Charts | Recharts |
| Deployment | Vercel (one-click deploy) |

---

## Project Structure

```
src/web/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Landing page
│   ├── lessons/            # Lesson grid + player
│   ├── progress/           # Kid progress dashboard
│   ├── parent/             # Parent dashboard (real-time charts)
│   ├── family/             # Parent → child link management
│   ├── admin/              # Admin panel (PDF Upload, User Mgmt)
│   └── api/v1/             # Route Handlers (AI, RAG, Cloudinary)
├── components/
│   ├── ai/                 # AITutorWidget (Cosmo)
│   ├── auth/               # AuthModal (Role-based login)
│   ├── layout/             # NavHeader, Shells (Kid/Parent/Admin)
│   └── shared/             # Neobrutalism UI components
├── lib/
│   ├── auth/               # Firebase auth context
│   ├── db/                 # Firestore configuration & helpers
│   ├── gamification/       # XP / badge logic
│   ├── lessons/            # Firestore-linked lesson store
│   ├── storage/            # Cloudinary upload utilities
│   └── user/               # Firestore user profile management
```

---

## Quick Start

### 1. Clone & install

```bash
git clone <repo-url>
cd <repo>/src/web
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
# Fill in Firebase, Cloudinary, and OpenAI keys
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
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | File uploads | Firebase Storage bucket (PDFs, avatars) |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Auth only | Firebase sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Auth only | Firebase app ID |
| `OPENAI_API_KEY` | AI features | OpenAI API key (chat, RAG, moderation) |
| `PINECONE_API_KEY` | RAG only | Pinecone vector DB key |
| `PINECONE_INDEX` | RAG only | Pinecone index name (default: `melon-lessons`) |
| `ELEVENLABS_API_KEY` | TTS only | ElevenLabs API key |
| `ELEVENLABS_VOICE_ID` | TTS only | Voice ID (default: Rachel) |
| `MELON_AI_BACKEND_URL` | Backend integration | FastAPI base URL (local dev example: `http://127.0.0.1:8001`) |
| `FIREBASE_ADMIN_PROJECT_ID` | Server admin features | Firebase Admin SDK project ID |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Server admin features | Firebase Admin SDK client email |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Server admin features | Firebase Admin SDK private key |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | File uploads | Cloudinary cloud name |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | File uploads | Cloudinary unsigned upload preset |
| `CLOUDINARY_API_KEY` | File uploads | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | File uploads | Cloudinary API secret |

> **Without any keys:** The app runs in demo mode — all pages work with mock data via localStorage.

---

## Features

### 👦 Student Experience
- **Lesson Player**: Neobrutalism design with Framer Motion animations.
- **AI Tutor (Cosmo)**: Real-time GPT-4o powered tutor with RAG support.
- **Gamification**: XP points, levels, and badges stored in Firestore.
- **Leaderboard**: Real-time ranking based on XP.

### 👨‍👩‍👧 Parent Experience
- **Dashboard**: Track time learned, lessons done, and XP growth via Recharts.
- **Family Link**: Link child accounts using their unique UID to monitor progress.

### 🛡️ Admin Experience
- **PDF Upload**: Upload textbooks/worksheets to Cloudinary.
- **RAG Ingestion**: Automatic chunking and embedding of PDFs into Pinecone.
- **User Promotion**: Promote regular users to Admin/Parent roles via the dashboard.

---

## Development Notes

- **Database**: We moved from `localStorage` to **Firestore**. All user progress is now persistent across devices.
- **Storage**: We use **Cloudinary** for PDFs to ensure they are served with correct headers for in-browser viewing.
- **Validation**: Forms are validated using **Zod** to prevent data entry errors.
- **Security**: Page routes are protected based on Firebase user roles (`kid`, `parent`, `admin`).

---

## Scripts

```bash
npm run dev        # Start dev server (Turbopack)
npm run build      # Production build
npm run lint       # ESLint
npm run type-check # TypeScript check
```

---

## Development Notes

- **Mock data**: Seed lessons live in `lib/lessons/lesson-store.ts`; generated local lessons live in browser localStorage.
- **Adding lessons**: Edit `MOCK_LESSONS` in `lib/lessons/lesson-store.ts` or upload PDFs through the admin RAG flow.
- **Design system**: All tokens defined in `app/globals.css` under `@theme inline` (Neobrutalism palette, Lexend Mega + Space Grotesk)
- **File uploads**: Use `lib/storage/upload.ts` — `uploadPdf(file)` uploads to Cloudinary through `/api/upload`.
- **API routes**: `app/api/v1/` now proxies to `melon-ai-backend` for ingest/generate/tts
- **Deploy**: Connect repo to [Vercel](https://vercel.com) → set env vars → auto-deploy on push (`infra/vercel.json`)

---
## Contributing

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Commit with conventional commits: `git commit -m "feat: add quiz timer"`
3. Open a pull request against `main`

> **Never commit `.env.local`** — it is gitignored. Share keys via team password manager.
