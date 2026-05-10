import os
import uuid
from fastapi import APIRouter, UploadFile, File, BackgroundTasks, Form
from pydantic import BaseModel
from services.rag_service import ingest_document, retrieve_context
from services.llm_service import generate_lesson_content
from services.image_service import generate_image
from services.tts_service import text_to_speech

router = APIRouter()

# Schemas
class GenerateRequest(BaseModel):
    topic: str
    file_id: str = None # If provided, use RAG

class TTSRequest(BaseModel):
    text: str

@router.post("/ingest")
async def ingest_file(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    os.makedirs("uploads", exist_ok=True)
    temp_path = f"uploads/{file.filename}"
    
    with open(temp_path, "wb") as f:
        f.write(await file.read())
        
    # Process synchrounously for simplicity, should be BackgroundTask
    chunks_count = ingest_document(temp_path, file_id)
    return {"message": "success", "file_id": file_id, "chunks": chunks_count}

@router.post("/generate")
def generate_content(req: GenerateRequest):
    context = ""
    if req.file_id:
        context = retrieve_context(query=f"Explain {req.topic}", file_id=req.file_id)
        
    questions = generate_lesson_content(topic=req.topic, context=context)
    
    lesson_data = {
        "topic": req.topic,
        "questions": questions,
        "flashcards": []  # Generate flashcards if needed for image generation
    }
    
    # If the LLM returning questions didn't provide flashcards, we can generate a title card or iterate over questions for images
    for i, q in enumerate(lesson_data.get("questions", [])):
        img_prompt = f"cartoon illustration of kids learning about {req.topic}: {q['question']}"
        img_url = generate_image(img_prompt, filename=f"img_{uuid.uuid4().hex[:6]}.png")
        q["image_url"] = img_url
        
    return lesson_data

@router.post("/tts")
def synthesize_speech(req: TTSRequest):
    audio_url = text_to_speech(req.text, filename=f"tts_{uuid.uuid4().hex[:6]}.mp3")
    return {"audio_url": audio_url}