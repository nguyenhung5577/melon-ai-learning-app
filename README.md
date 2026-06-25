# Melon AI Learning App

AI-assisted learning app with a Next.js frontend and a FastAPI AI backend.

## Project Structure

```text
.
├── src/
│   ├── web/                 # Next.js frontend
│   └── melon-ai-backend/    # FastAPI AI backend
├── docs/                    # Project documentation
├── pa/                      # Course/project assets
└── README.md
```

Runtime artifacts such as `.env`, `__pycache__`, Chroma databases, uploads, generated audio, logs, `.next`, and `node_modules` are ignored by Git.

## Prerequisites

- Node.js compatible with Next.js 16
- npm
- Conda
- A conda environment named `myenv`

Create the conda environment if it does not exist:

```bash
conda create -n myenv python=3.11
```

## Backend Setup

Install Python dependencies:

```bash
cd <repo>/src/melon-ai-backend
conda activate myenv
pip install -r requirements.txt
```

Create backend environment file:

```bash
cp .env.example .env
```

At minimum, set keys needed by the backend features you want to test:

```env
OPENROUTER_API_KEY=...
ELEVENLABS_API_KEY=...
```

Run the backend:

```bash
cd <repo>/src/melon-ai-backend
conda activate myenv
uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

Check backend health:

```bash
curl http://127.0.0.1:8001/health
```

Expected response:

```json
{"status":"ok","message":"Melon AI is running"}
```

Backend docs:

```text
http://127.0.0.1:8001/docs
```

## Frontend Setup

Install dependencies:

```bash
cd <repo>/src/web
npm install
```

Create frontend environment file:

```bash
cp .env.example .env.local
```

Set the backend URL:

```env
MELON_AI_BACKEND_URL=http://127.0.0.1:8001
```

Fill Firebase, Cloudinary, and other keys as needed for the features you are testing.

Run the frontend:

```bash
cd <repo>/src/web
npm run dev
```

Frontend URL:

```text
http://localhost:3000
```

To expose the frontend on the local network:

```bash
npm run dev -- -H 0.0.0.0
```

Then open the Network URL printed by Next.js from another device on the same Wi-Fi.

## Common Development Flow

1. Start backend from `src/melon-ai-backend` using conda env `myenv`.
2. Start frontend from `src/web`.
3. Open `http://localhost:3000`.
4. Use lesson, practice, and question-bank flows to call the backend through Next.js API routes.

## Useful Commands

Frontend:

```bash
cd <repo>/src/web
npm run dev
npm run build
npm run lint
npm run type-check
```

Backend:

```bash
cd <repo>/src/melon-ai-backend
conda activate myenv
uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

## Notes

- Generated audio and uploaded files are runtime artifacts and are ignored by Git.
- Local `.env` files are ignored by Git. Share secrets through the team secret manager, not commits.
