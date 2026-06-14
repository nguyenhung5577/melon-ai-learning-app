import os
import asyncio
import time
import uuid
from fastapi import APIRouter, UploadFile, File, Request, HTTPException
from pydantic import BaseModel
from services.rag_service import ingest_document, retrieve_context
from services.llm_service import (
    generate_lesson_content,
    generate_exercise_questions,
    generate_exercise_guidance,
    analyze_problem_image,
)
from services.problem_parser_service import (
    ParserInputFile,
    fetch_remote_file,
    parse_problem_sources_batch,
    parse_problem_sources,
)
from services.tts_service import text_to_speech
from concurrent.futures import ThreadPoolExecutor
from threading import Lock

router = APIRouter()
executor = ThreadPoolExecutor(max_workers=2)
ingest_jobs: dict[str, dict] = {}
jobs_lock = Lock()

# Schemas
class GenerateRequest(BaseModel):
    topic: str
    file_id: str = None # If provided, use RAG
    include_images: bool = False

class TTSRequest(BaseModel):
    text: str

class ExerciseGenerateRequest(BaseModel):
    topic: str
    file_id: str
    count: int = 5
    difficulty: str = "medium"

class ExerciseGuideRequest(BaseModel):
    question: str
    student_answer: str | None = None
    correct_answer: str | None = None
    file_id: str | None = None
    topic: str | None = None

class ParseImageRequest(BaseModel):
    image_url: str

class ProblemParseRequest(BaseModel):
    sourceType: str = "text"
    text: str | None = None
    fileUrl: str | None = None
    fileUrls: list[str] | None = None
    grade: int = 5
    subject: str = "math"
    language: str = "vi"
    questionSetTitle: str | None = None
    pageRange: str | None = None
    parseAllSets: bool = False
    skipFirstSet: bool = False

@router.post("/ingest")
async def ingest_file(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    os.makedirs("uploads", exist_ok=True)
    temp_path = f"uploads/{file.filename}"
    
    with open(temp_path, "wb") as f:
        f.write(await file.read())

    with jobs_lock:
        ingest_jobs[job_id] = {
            "status": "queued",
            "file_id": file_id,
            "chunks": None,
            "error": None,
            "timings_ms": {},
            "created_at": time.time(),
            "started_at": None,
            "ended_at": None,
        }

    def run_ingest():
        t0 = time.perf_counter()
        with jobs_lock:
            ingest_jobs[job_id]["status"] = "processing"
            ingest_jobs[job_id]["started_at"] = time.time()
        try:
            t_ingest_start = time.perf_counter()
            chunks_count = ingest_document(temp_path, file_id)
            ingest_ms = (time.perf_counter() - t_ingest_start) * 1000
            total_ms = (time.perf_counter() - t0) * 1000
            with jobs_lock:
                ingest_jobs[job_id]["status"] = "completed"
                ingest_jobs[job_id]["chunks"] = chunks_count
                ingest_jobs[job_id]["timings_ms"] = {
                    "ingest_backend": round(ingest_ms, 2),
                    "job_total": round(total_ms, 2),
                }
                ingest_jobs[job_id]["ended_at"] = time.time()
        except Exception as error:
            total_ms = (time.perf_counter() - t0) * 1000
            with jobs_lock:
                ingest_jobs[job_id]["status"] = "failed"
                ingest_jobs[job_id]["error"] = str(error)
                ingest_jobs[job_id]["timings_ms"] = {
                    "job_total": round(total_ms, 2),
                }
                ingest_jobs[job_id]["ended_at"] = time.time()

    executor.submit(run_ingest)
    return {"message": "processing", "job_id": job_id, "file_id": file_id, "status": "queued"}

@router.get("/ingest/{job_id}")
def get_ingest_status(job_id: str):
    with jobs_lock:
        job = ingest_jobs.get(job_id)

    if not job:
        return {"error": "job not found", "job_id": job_id, "status": "not_found"}

    return {
        "job_id": job_id,
        "status": job["status"],
        "file_id": job["file_id"],
        "chunks": job["chunks"],
        "error": job["error"],
        "timings_ms": job.get("timings_ms", {}),
        "created_at": job.get("created_at"),
        "started_at": job.get("started_at"),
        "ended_at": job.get("ended_at"),
    }

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
    
    if req.include_images:
        lesson_data["image_generation"] = {
            "enabled": False,
            "reason": "Local HuggingFace Stable Diffusion is disabled for this backend.",
        }
        
    return lesson_data

@router.post("/tts")
def synthesize_speech(req: TTSRequest):
    audio_url = text_to_speech(req.text, filename=f"tts_{uuid.uuid4().hex[:6]}.mp3")
    return {"audio_url": audio_url}

@router.post("/exercise/generate")
def generate_exercise(req: ExerciseGenerateRequest):
    context = retrieve_context(
        query=f"Create grounded exercises from this document about {req.topic}. Focus on concrete facts, definitions, numbers, and processes explicitly present in text.",
        file_id=req.file_id,
        top_k=10,
    )
    questions = generate_exercise_questions(
        topic=req.topic,
        context=context,
        count=max(1, min(req.count, 10)),
        difficulty=req.difficulty,
    )
    return {
        "topic": req.topic,
        "file_id": req.file_id,
        "count": len(questions),
        "questions": questions,
    }

@router.post("/exercise/guide")
def guide_exercise(req: ExerciseGuideRequest):
    context = ""
    if req.file_id:
        context = retrieve_context(
            query=req.question,
            file_id=req.file_id,
            top_k=3,
        )

    guidance = generate_exercise_guidance(
        question=req.question,
        student_answer=req.student_answer,
        correct_answer=req.correct_answer,
        context=context,
    )
    audio_url = text_to_speech(guidance, filename=f"guide_{uuid.uuid4().hex[:6]}.mp3")
    return {
        "guidance": guidance,
        "audio_url": audio_url,
        "topic": req.topic,
    }

@router.post("/exercise/parse-image")
def parse_problem_image(req: ParseImageRequest):
    """
    Endpoint nhận URL ảnh (đã được làm nét từ Frontend), 
    gọi Vision AI để trích xuất text, bảng biểu markdown và tọa độ ảnh minh họa.
    """
    if not req.image_url:
        raise HTTPException(status_code=400, detail="Missing image_url")
    
    # Gọi service Vision AI chúng ta vừa hoàn thiện
    result = analyze_problem_image(req.image_url)
    
    # Lớp bảo hiểm: Bắt lỗi nếu AI thất bại
    if "error" in result and result["error"]:
        raise HTTPException(status_code=500, detail=result["error"])
        
    return result

@router.post("/problems/parse")
async def parse_problem(
    request: Request,
):
    content_type = request.headers.get("content-type", "")

    try:
        if "multipart/form-data" in content_type:
            form = await request.form()
            upload_files: list[UploadFile] = []
            for field_name in ("files", "file"):
                for value in form.getlist(field_name):
                    if hasattr(value, "filename") and hasattr(value, "read"):
                        upload_files.append(value)

            text = str(form.get("text") or "")
            subject = str(form.get("subject") or "math")
            language = str(form.get("language") or "vi")
            page_range_value = form.get("pageRange")
            page_range = str(page_range_value) if page_range_value else None
            parse_all_sets = str(form.get("parseAllSets") or "").lower() == "true"
            skip_first_set = str(form.get("skipFirstSet") or "").lower() == "true"
            question_set_title_value = form.get("questionSetTitle")
            question_set_title = str(question_set_title_value) if question_set_title_value else None
            try:
                grade = int(str(form.get("grade") or "5"))
            except ValueError:
                grade = 5

            parser_files = [
                ParserInputFile(
                    filename=upload.filename or f"upload-{index + 1}",
                    content_type=upload.content_type or "application/octet-stream",
                    data=await upload.read(),
                )
                for index, upload in enumerate(upload_files)
            ]
            if parse_all_sets:
                return await asyncio.to_thread(
                    parse_problem_sources_batch,
                text=text,
                files=parser_files,
                grade=grade,
                subject=subject,
                language=language,
                question_set_title=question_set_title,
                page_range=page_range,
                skip_first_set=skip_first_set,
            )
            return await asyncio.to_thread(
                parse_problem_sources,
                text=text,
                files=parser_files,
                grade=grade,
                subject=subject,
                language=language,
                question_set_title=question_set_title,
                page_range=page_range,
            )

        body = ProblemParseRequest.model_validate(await request.json())
        parser_files: list[ParserInputFile] = []
        remote_urls = []
        if body.fileUrl:
            remote_urls.append(body.fileUrl)
        if body.fileUrls:
            remote_urls.extend(body.fileUrls)
        for file_url in remote_urls:
            parser_files.append(fetch_remote_file(file_url))

        if body.parseAllSets:
            return await asyncio.to_thread(
                parse_problem_sources_batch,
                text=body.text,
                files=parser_files,
                grade=body.grade,
                subject=body.subject,
                language=body.language,
                question_set_title=body.questionSetTitle,
                page_range=body.pageRange,
                skip_first_set=body.skipFirstSet,
            )

        return await asyncio.to_thread(
            parse_problem_sources,
            text=body.text,
            files=parser_files,
            grade=body.grade,
            subject=body.subject,
            language=body.language,
            question_set_title=body.questionSetTitle,
            page_range=body.pageRange,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Problem parsing failed: {error}",
        ) from error
