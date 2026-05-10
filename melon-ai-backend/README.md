# Melon AI Backend Pipeline

This is the lightweight FastAPI backend that serves all the AI requirements for the Melon App. It wraps exactly 3 main components:
1. **RAG & Gen (LLM)** - Document parsing (RAG) and Lesson Generation powered by OpenRouter (GPT-4o-mini).
2. **Image Gen** - Powered by Stable Diffusion v1.5 via HuggingFace `diffusers`.
3. **Text to Speech (TTS)** - Powered by `ElevenLabs`.

## Project Structure
```
melon-ai-backend/
├── main.py
├── api/
│   └── endpoints.py
├── services/
│   ├── rag_service.py    (Document parsing, Chunking, Embeddings, ChromaDB Local)
│   ├── llm_service.py    (Lesson & MCQ Generation logic via OpenRouter)
│   ├── image_service.py  (Stable Diffusion v1.5 locally loaded via diffusers)
│   └── tts_service.py    (ElevenLabs)
├── .env.example
└── requirements.txt
```

## Setup & Run Local

**1. Create virtual environment & install requirements**
```bash
cd desktop/SEAI/Sprint2/melon-ai-backend
pip install -r requirements.txt
```

**2. Setup your environment keys**
Create a `.env` file and insert your necessary keys:
- `ELEVENLABS_API_KEY`: Get this from elevenlabs.io
- Note: OpenRouter API keys are currently hardcoded in testing files, but ensure they are secure in production.

**3. Run the Server**
```bash
python main.py
# OR
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
*The app will run locally on http://localhost:8000.*

---

## Endpoint API Usage Guide

FastAPI automatically provisions an interactive Swagger UI. You can test all endpoints visually by going to:
👉 **[http://localhost:8000/docs](http://localhost:8000/docs)**

If you are calling the API from the frontend application (via `fetch` or `axios`), here is the comprehensive guide for each AI module endpoint. All endpoints are prefixed with `/api/v1`.

### 1. File Ingestion (RAG Module)
Upload educational materials (PDFs/Text) to create a knowledge base. The document is chunked and stored in a vector database for later retrieval.

- **URL:** `POST /api/v1/ingest`
- **Content-Type:** `multipart/form-data`
- **Payload:**
  - `file`: The file to be uploaded.

**Example Client Request (JavaScript):**
```javascript
const formData = new FormData();
formData.append("file", fileInput.files[0]);

const response = await fetch("http://localhost:8000/api/v1/ingest", {
    method: "POST",
    body: formData
});
const data = await response.json();
console.log("File ID for context:", data.file_id);
```
**Returns:**
```json
{
  "message": "success",
  "file_id": "uuid-string-here",
  "chunks": 10
}
```

### 2. Generate Content (LLM + Image Modules)
Generates educational lesson content (Multiple Choice Questions) based on a topic. Optionally, it can utilize the uploaded context (RAG) using the `file_id`. Once questions are generated, it routes requests to the **Image Service (Stable Diffusion)** to generate contextual images for each question.

- **URL:** `POST /api/v1/generate`
- **Content-Type:** `application/json`
- **Payload:**
  - `topic` (string, required): The topic of the lesson (e.g., "Solar System").
  - `file_id` (string, optional): The ID returned from the `/ingest` step to ground the generation in your specific file context.

**Example Client Request (JavaScript):**
```javascript
const response = await fetch("http://localhost:8000/api/v1/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        topic: "The Solar System",
        file_id: "uuid-string-here" // Optional
    })
});
const lessonData = await response.json();
console.log(lessonData);
```
**Returns:**
```json
{
  "topic": "The Solar System",
  "questions": [
    {
      "question": "Which planet is closest to the sun?",
      "choices": {
        "A": "Earth",
        "B": "Mars",
        "C": "Mercury",
        "D": "Venus"
      },
      "answer": "C",
      "image_url": "/static/images/img_a1b2c3.png"
    }
  ],
  "flashcards": []
}
```
*Note: The frontend can display the AI-generated images using the `image_url` string.*

### 3. Text-to-Speech (TTS Module)
Convert any text output into high-quality spoken audio. Great for reading lessons or questions out loud to children.

- **URL:** `POST /api/v1/tts`
- **Content-Type:** `application/json`
- **Payload:**
  - `text` (string, required): The text to synthesize into speech.

**Example Client Request (JavaScript):**
```javascript
const response = await fetch("http://localhost:8000/api/v1/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        text: "Tuyệt vời, con giỏi lắm!" // Example text
    })
});
const data = await response.json();
console.log("Audio URL:", data.audio_url);
```
**Returns:**
```json
{
  "audio_url": "/static/audio/tts_d4e5f6.mp3"
}
```
*Note: Make sure static endpoints are configured in FastAPI if serving these files directly, or adapt the frontend to fetch the audio paths correctly.*
