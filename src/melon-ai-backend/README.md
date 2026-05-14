# Melon AI Backend

FastAPI backend for Melon AI features:

- PDF ingestion and local RAG storage with ChromaDB
- Lesson and exercise generation through the LLM service
- Exercise guidance
- Text-to-speech through ElevenLabs

## Structure

```text
src/melon-ai-backend/
├── main.py
├── api/
│   └── endpoints.py
├── services/
│   ├── rag_service.py
│   ├── llm_service.py
│   └── tts_service.py
├── requirements.txt
└── README.md
```

Runtime directories such as `chroma_db/`, `uploads/`, `generations/`, `.env`, and `__pycache__/` are ignored by Git.

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

### Ingest a PDF

```http
POST /api/v1/ingest
Content-Type: multipart/form-data
```

Payload:

- `file`: PDF file

Example:

```bash
curl -F "file=@example.pdf" http://127.0.0.1:8001/api/v1/ingest
```

Returns a `job_id` and `file_id`. Poll the job:

```bash
curl http://127.0.0.1:8001/api/v1/ingest/<job_id>
```

### Generate Lesson Content

```http
POST /api/v1/generate
Content-Type: application/json
```

Payload:

```json
{
  "topic": "The Solar System",
  "file_id": "optional-file-id"
}
```

### Generate Exercises

```http
POST /api/v1/exercise/generate
Content-Type: application/json
```

Payload:

```json
{
  "topic": "The Solar System",
  "file_id": "file-id-from-ingest",
  "count": 5,
  "difficulty": "medium"
}
```

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
- ChromaDB may print telemetry warnings in local development; they do not block the app if `/health` works.
