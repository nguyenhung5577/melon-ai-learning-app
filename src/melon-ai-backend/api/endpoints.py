import asyncio
import uuid
from fastapi import APIRouter, UploadFile, File, Request, HTTPException
from pydantic import BaseModel
from services.llm_service import (
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

router = APIRouter()

# Schemas
class TTSRequest(BaseModel):
    text: str

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

@router.post("/tts")
def synthesize_speech(req: TTSRequest):
    audio_url = text_to_speech(req.text, filename=f"tts_{uuid.uuid4().hex[:6]}.mp3")
    return {"audio_url": audio_url}

@router.post("/exercise/guide")
def guide_exercise(req: ExerciseGuideRequest):
    guidance = generate_exercise_guidance(
        question=req.question,
        student_answer=req.student_answer,
        correct_answer=req.correct_answer,
        context="",
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
