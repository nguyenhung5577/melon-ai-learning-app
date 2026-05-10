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

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | All Firebase Client keys for Auth and Firestore |
| `FIREBASE_ADMIN_PROJECT_ID` | Firebase Admin SDK Project ID |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Firebase Admin SDK Email |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Firebase Admin SDK Private Key |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary Cloud Name |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Cloudinary Upload Preset (unsigned) |
| `CLOUDINARY_API_KEY` | Cloudinary API Key |
| `CLOUDINARY_API_SECRET` | Cloudinary API Secret |
| `OPENAI_API_KEY` | OpenAI API key (chat, RAG, moderation) |
| `PINECONE_API_KEY` | Pinecone vector DB key |
| `PINECONE_INDEX` | Pinecone index name |

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

## Contributing

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Commit with conventional commits: `git commit -m "feat: add quiz timer"`
3. Open a pull request against `main`

> **Never commit `.env.local`** — it is gitignored. Share keys via team password manager.
