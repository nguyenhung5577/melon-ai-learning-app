# PA3 Working Software Demo

## Demo Video

Link: TBD

## Demo Scope

This working software demo focuses on two main flows:

- Flow 1: Parent login, parent dashboard overview, setting study goals for a child, creating a child account, child login, and selected child-facing learning interfaces.
- Flow 2: Admin login, uploading an image to parse math questions, reviewing parsed questions, and saving them into the shared question bank.

## Features Have Been Implemented

- Parent authentication flow.
- Parent dashboard showing child learning progress, learning goals, weak topics, and time commitment.
- Parent can set study goals for a child.
- Parent can create a child account with child login credentials.
- Child can log in using child ID/PIN.
- Child can access learning pages such as lessons, practice, progress, badges, and leaderboard.
- Admin can access the question bank module.
- Admin can upload an image/PDF/text source and parse math questions.
- Parsed questions can be reviewed with answers and choices.
- Admin can save parsed questions into the shared question bank.

## How To Run

Backend:

```bash
cd src/melon-ai-backend
conda activate myenv
uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

Frontend:

```bash
cd src/web
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:3000
```

Backend health check:

```text
http://127.0.0.1:8001/health
```

## Limitations

- The system does not yet support LLM-based personalized question generation for each child.
- The system does not yet provide a complete set of pre-created lessons for students to study.
- The parser is optimized for Vietnamese grade 4-5 math questions and may be less accurate for other subjects or formats.
- The UI is implemented for core demo flows, not all planned production workflows.

## Known Defects

- OCR/AI parsing may occasionally produce incorrect question numbering or answer text, so admin review is required before saving.
- For questions with illustrative images, the image crop may sometimes include too much surrounding content or fail to detect the image.
