# Melon AI Backend

FastAPI backend for Melon AI features:

- Problem parsing through the LLM/Vision parser service
- Exercise guidance
- Text-to-speech through ElevenLabs

## Structure

```text
src/melon-ai-backend/
├── main.py
├── api/
│   └── endpoints.py
├── services/
│   ├── llm_service.py
│   ├── problem_parser_service.py
│   └── tts_service.py
├── requirements.txt
└── README.md
```

Runtime directories such as `uploads/`, `generations/`, `.env`, and `__pycache__/` are ignored by Git.

## Setup

Use the project conda environment `myenv`:

```bash
conda create -n myenv python=3.11
conda activate myenv
```

Install dependencies:

```bash
cd <repo>/src/melon-ai-backend
pip install -r requirements.txt
```

Create local environment file:

```bash
cp .env.example .env
```

Configure only the keys needed for the features you are testing:

```env
OPENROUTER_API_KEY=...
ELEVENLABS_API_KEY=...
```

## Run

```bash
cd <repo>/src/melon-ai-backend
conda activate myenv
uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

Health check:

```bash
curl http://127.0.0.1:8001/health
```

Swagger UI:

```text
http://127.0.0.1:8001/docs
```

## Frontend Integration

In `src/web/.env.local`, point the frontend proxy routes to this backend:

```env
MELON_AI_BACKEND_URL=http://127.0.0.1:8001
```

Restart the Next.js dev server after changing `.env.local`.

## API Overview

All routes are prefixed with `/api/v1`.

### Exercise Guidance

```http
POST /api/v1/exercise/guide
Content-Type: application/json
```

Payload:

```json
{
  "question": "Which planet is closest to the sun?",
  "correct_answer": "Mercury",
  "topic": "The Solar System"
}
```

### Text To Speech

```http
POST /api/v1/tts
Content-Type: application/json
```

Payload:

```json
{
  "text": "Great job!"
}
```

## Notes

- Local HuggingFace model loading is not required for this backend setup.
