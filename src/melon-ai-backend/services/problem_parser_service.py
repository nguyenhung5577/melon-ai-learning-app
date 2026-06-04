import base64
import io
import json
import mimetypes
import os
import hashlib
import re
import time
import unicodedata
import zipfile
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse
from xml.etree import ElementTree

import fitz  # PyMuPDF
import requests
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_OCR_MODEL = "google/gemini-2.5-pro"
DEFAULT_PARSE_MODEL = "openai/gpt-4.1"
MAX_IMAGE_PAGES = int(os.getenv("OPENROUTER_PARSE_MAX_IMAGE_PAGES", "12"))
PDF_TEXT_MIN_CHARS_PER_PAGE = int(os.getenv("PDF_TEXT_MIN_CHARS_PER_PAGE", "80"))
ENABLE_OCR_PASS = os.getenv("OPENROUTER_PARSE_OCR", "1") == "1"
ENABLE_REPAIR_PASS = os.getenv("OPENROUTER_PARSE_REPAIR", "0") == "1"
IMAGE_SLICE_MAX_HEIGHT = int(os.getenv("OPENROUTER_IMAGE_SLICE_MAX_HEIGHT", "760"))
IMAGE_SLICE_OVERLAP = int(os.getenv("OPENROUTER_IMAGE_SLICE_OVERLAP", "120"))
IMAGE_SLICE_SCALE = float(os.getenv("OPENROUTER_IMAGE_SLICE_SCALE", "1.4"))
OCR_BATCH_SIZE = int(os.getenv("OPENROUTER_OCR_BATCH_SIZE", "6"))
OPENROUTER_TIMEOUT_SECONDS = int(os.getenv("OPENROUTER_PARSE_TIMEOUT_SECONDS", "180"))
DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
WORD_NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}


@dataclass
class ParserInputFile:
    filename: str
    content_type: str
    data: bytes
    source_url: str | None = None


@dataclass
class PreparedSource:
    text_blocks: list[str]
    image_parts: list[dict[str, Any]]
    source_files: list[str]


def _parse_model_name() -> str:
    return (
        os.getenv("OPENROUTER_PARSE_MODEL")
        or os.getenv("OPENROUTER_MODEL")
        or DEFAULT_PARSE_MODEL
    )


def _ocr_model_name() -> str:
    return (
        os.getenv("OPENROUTER_OCR_MODEL")
        or os.getenv("OPENROUTER_VISION_MODEL")
        or os.getenv("OPENROUTER_PARSE_MODEL")
        or os.getenv("OPENROUTER_MODEL")
        or DEFAULT_OCR_MODEL
    )


def _openrouter_headers() -> dict[str, str]:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("Missing OPENROUTER_API_KEY in backend environment")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    app_url = os.getenv("OPENROUTER_SITE_URL")
    app_title = os.getenv("OPENROUTER_APP_TITLE", "Melon AI Learning App")
    if app_url:
        headers["HTTP-Referer"] = app_url
    if app_title:
        headers["X-Title"] = app_title
    return headers


def _parse_json_object(raw: str) -> dict[str, Any]:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw).strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(raw[start : end + 1])
        raise


def _repair_json(raw: str, *, schema_hint: str) -> dict[str, Any]:
    prompt = f"""
Convert the following malformed model output into valid JSON.
Return valid JSON only. Do not add markdown or explanations.
Preserve all Vietnamese text, math symbols, answer choices, answers, and arrays.
If a field is missing, fill it with an empty string, empty array, or 0.8 confidence as appropriate.

Expected schema:
{schema_hint}

Malformed output:
{raw}
""".strip()
    repaired = _call_openrouter(
        [
            {
                "role": "user",
                "content": [{"type": "text", "text": prompt}],
            }
        ],
        force_json=True,
    )
    return _parse_json_object(repaired)


def _data_url(data: bytes, content_type: str) -> str:
    encoded = base64.b64encode(data).decode("ascii")
    return f"data:{content_type};base64,{encoded}"


def _image_part(label: str, data: bytes, content_type: str, source_url: str | None = None) -> dict[str, Any]:
    return {
        "label": label,
        "source_url": source_url,
        "part": {
            "type": "image_url",
            "image_url": {"url": _data_url(data, content_type)},
        },
    }


def _fitz_image_filetype(filename: str, content_type: str) -> str:
    lower_name = filename.lower()
    if "png" in content_type or lower_name.endswith(".png"):
        return "png"
    if "webp" in content_type or lower_name.endswith(".webp"):
        return "webp"
    if "gif" in content_type or lower_name.endswith(".gif"):
        return "gif"
    if "bmp" in content_type or lower_name.endswith(".bmp"):
        return "bmp"
    return "jpeg"


def _guess_content_type(filename: str, fallback: str = "application/octet-stream") -> str:
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or fallback


def _render_page_slices(page: fitz.Page, *, label: str, source_url: str | None = None) -> list[dict[str, Any]]:
    rect = page.rect
    if rect.is_empty or rect.height <= 0 or rect.width <= 0:
        return []

    if rect.height <= IMAGE_SLICE_MAX_HEIGHT:
        pix = page.get_pixmap(matrix=fitz.Matrix(IMAGE_SLICE_SCALE, IMAGE_SLICE_SCALE), alpha=False)
        return [_image_part(label, pix.tobytes("png"), "image/png", source_url)]

    slices: list[dict[str, Any]] = []
    step = max(IMAGE_SLICE_MAX_HEIGHT - IMAGE_SLICE_OVERLAP, 1)
    y0 = 0.0
    slice_index = 1
    while y0 < rect.height and len(slices) < MAX_IMAGE_PAGES:
        y1 = min(rect.height, y0 + IMAGE_SLICE_MAX_HEIGHT)
        clip = fitz.Rect(rect.x0, y0, rect.x1, y1)
        pix = page.get_pixmap(
            matrix=fitz.Matrix(IMAGE_SLICE_SCALE, IMAGE_SLICE_SCALE),
            clip=clip,
            alpha=False,
        )
        position = "top" if y0 == 0 else "bottom" if y1 >= rect.height else "middle"
        slice_label = f"{label} slice {slice_index} ({position}, y={round(y0)}-{round(y1)})"
        slices.append(_image_part(slice_label, pix.tobytes("png"), "image/png", source_url))
        if y1 >= rect.height:
            break
        y0 += step
        slice_index += 1
    return slices


def _extract_image_slices(file: ParserInputFile, content_type: str) -> list[dict[str, Any]]:
    label = file.source_url or file.filename
    doc = None
    try:
        doc = fitz.open(stream=file.data, filetype=_fitz_image_filetype(file.filename, content_type))
        if doc.page_count == 0:
            return [_image_part(label, file.data, content_type, file.source_url)]
        slices = _render_page_slices(doc.load_page(0), label=label, source_url=file.source_url)
        return slices or [_image_part(label, file.data, content_type, file.source_url)]
    except Exception:
        return [_image_part(label, file.data, content_type, file.source_url)]
    finally:
        if doc is not None:
            doc.close()


def _extract_pdf(file: ParserInputFile) -> PreparedSource:
    return _extract_pdf_pages(file, page_range=None)


def _parse_page_range(page_range: str | None, page_count: int) -> list[int]:
    if not page_range or not page_range.strip():
        return list(range(page_count))

    selected: set[int] = set()
    for raw_part in page_range.split(","):
        part = raw_part.strip()
        if not part:
            continue
        if "-" in part:
            start_raw, end_raw = part.split("-", 1)
            try:
                start = int(start_raw.strip())
                end = int(end_raw.strip())
            except ValueError:
                continue
            if start > end:
                start, end = end, start
            for page_number in range(start, end + 1):
                if 1 <= page_number <= page_count:
                    selected.add(page_number - 1)
            continue

        try:
            page_number = int(part)
        except ValueError:
            continue
        if 1 <= page_number <= page_count:
            selected.add(page_number - 1)

    return sorted(selected) or list(range(page_count))


def _format_page_indices(page_indices: list[int]) -> str:
    if not page_indices:
        return ""

    ranges: list[str] = []
    start = page_indices[0]
    previous = page_indices[0]
    for page_index in page_indices[1:]:
        if page_index == previous + 1:
            previous = page_index
            continue
        ranges.append(f"{start + 1}-{previous + 1}" if start != previous else str(start + 1))
        start = page_index
        previous = page_index
    ranges.append(f"{start + 1}-{previous + 1}" if start != previous else str(start + 1))
    return ",".join(ranges)


def _contiguous_page_runs(page_indices: list[int]) -> list[list[int]]:
    if not page_indices:
        return []
    runs: list[list[int]] = [[page_indices[0]]]
    for page_index in page_indices[1:]:
        if page_index == runs[-1][-1] + 1:
            runs[-1].append(page_index)
        else:
            runs.append([page_index])
    return runs


def _extract_stacked_fraction_notes(page: fitz.Page) -> str:
    try:
        page_dict = page.get_text("dict")
    except Exception:
        return ""

    number_spans: list[dict[str, float | str]] = []
    for block in page_dict.get("blocks", []):
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                text = str(span.get("text") or "").strip()
                if not re.fullmatch(r"\d{1,4}", text):
                    continue
                bbox = span.get("bbox")
                if not isinstance(bbox, (list, tuple)) or len(bbox) != 4:
                    continue
                x0, y0, x1, y1 = [float(value) for value in bbox]
                number_spans.append(
                    {
                        "text": text,
                        "x": (x0 + x1) / 2,
                        "y": (y0 + y1) / 2,
                        "height": y1 - y0,
                        "x0": x0,
                        "x1": x1,
                    }
                )

    fractions: list[tuple[float, float, str]] = []
    used_denominators: set[int] = set()
    for numerator_index, numerator in enumerate(number_spans):
        best_denominator_index: int | None = None
        best_score = 999.0
        for denominator_index, denominator in enumerate(number_spans):
            if denominator_index == numerator_index or denominator_index in used_denominators:
                continue
            dy = float(denominator["y"]) - float(numerator["y"])
            dx = abs(float(denominator["x"]) - float(numerator["x"]))
            avg_height = (float(numerator["height"]) + float(denominator["height"])) / 2
            if dy <= avg_height * 0.65 or dy > avg_height * 2.6:
                continue
            if dx > max(5.0, avg_height * 0.45):
                continue
            score = dx + dy * 0.1
            if score < best_score:
                best_score = score
                best_denominator_index = denominator_index

        if best_denominator_index is None:
            continue
        denominator = number_spans[best_denominator_index]
        used_denominators.add(best_denominator_index)
        fractions.append(
            (
                float(numerator["y"]),
                float(numerator["x"]),
                f"{numerator['text']}/{denominator['text']}",
            )
        )

    if not fractions:
        return ""

    ordered = [value for _, _, value in sorted(fractions)]
    unique_ordered = list(dict.fromkeys(ordered))
    return "Detected stacked vertical fractions on this PDF page, in reading order: " + ", ".join(unique_ordered)


def _extract_pdf_pages(file: ParserInputFile, page_range: str | None) -> PreparedSource:
    doc = fitz.open(stream=file.data, filetype="pdf")
    text_blocks: list[str] = []
    image_parts: list[dict[str, Any]] = []

    selected_pages = _parse_page_range(page_range, doc.page_count)
    range_suffix = f" pages {page_range}" if page_range else ""
    for page_index in selected_pages:
        page = doc.load_page(page_index)
        page_label = f"{file.filename} page {page_index + 1}"
        page_text = page.get_text("text").strip()
        fraction_notes = _extract_stacked_fraction_notes(page)
        if fraction_notes:
            page_text = f"{page_text}\n\n--- math layout notes ---\n{fraction_notes}".strip()
        if page_text:
            text_blocks.append(f"--- {page_label} text ---\n{page_text}")

        if len(page_text) < PDF_TEXT_MIN_CHARS_PER_PAGE and len(image_parts) < MAX_IMAGE_PAGES:
            image_parts.extend(_render_page_slices(page, label=page_label, source_url=file.source_url))
            image_parts = image_parts[:MAX_IMAGE_PAGES]

    doc.close()
    source_label = f"{file.source_url or file.filename}{range_suffix}"
    return PreparedSource(text_blocks=text_blocks, image_parts=image_parts, source_files=[source_label])


def detect_pdf_exam_ranges(
    file: ParserInputFile,
    *,
    skip_first: bool = False,
    page_range: str | None = None,
) -> list[dict[str, str]]:
    doc = fitz.open(stream=file.data, filetype="pdf")
    selected_pages = _parse_page_range(page_range, doc.page_count)
    ranges: list[dict[str, str]] = []
    for run in _contiguous_page_runs(selected_pages):
        starts: list[tuple[int, str]] = []
        for page_index in run:
            page_text = doc.load_page(page_index).get_text("text")
            match = re.search(r"\b(?:ĐỀ|DE)\s*(\d+)\b", page_text, re.IGNORECASE)
            if match:
                starts.append((page_index, match.group(1)))

        if not starts:
            ranges.append({"label": f"Trang {_format_page_indices(run)}", "pageRange": _format_page_indices(run)})
            continue

        first_start = starts[0][0]
        prefix_pages = [page_index for page_index in run if page_index < first_start]
        if prefix_pages:
            ranges.append(
                {
                    "label": f"Trang {_format_page_indices(prefix_pages)}",
                    "pageRange": _format_page_indices(prefix_pages),
                }
            )

        for index, (start_index, exam_number) in enumerate(starts):
            next_start = starts[index + 1][0] if index + 1 < len(starts) else None
            exam_pages = [
                page_index
                for page_index in run
                if page_index >= start_index and (next_start is None or page_index < next_start)
            ]
            if not exam_pages:
                continue
            ranges.append(
                {
                    "label": f"Đề {exam_number}",
                    "pageRange": _format_page_indices(exam_pages),
                }
            )

    doc.close()
    if skip_first and ranges:
        return ranges[1:]
    return ranges


def _docx_relationships(docx: zipfile.ZipFile) -> dict[str, str]:
    try:
        rels_root = ElementTree.fromstring(docx.read("word/_rels/document.xml.rels"))
    except Exception:
        return {}

    relationships: dict[str, str] = {}
    for relationship in rels_root.findall("rel:Relationship", WORD_NS):
        rel_id = relationship.attrib.get("Id")
        target = relationship.attrib.get("Target")
        if not rel_id or not target:
            continue
        relationships[rel_id] = target if target.startswith("word/") else f"word/{target}"
    return relationships


def _docx_node_text(node: ElementTree.Element, relationships: dict[str, str]) -> str:
    parts: list[str] = []
    for child in node.iter():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "t" and child.text:
            parts.append(child.text)
        elif tag == "tab":
            parts.append("\t")
        elif tag in {"br", "cr"}:
            parts.append("\n")
        elif tag == "blip":
            embed_id = child.attrib.get(f"{{{WORD_NS['r']}}}embed")
            image_path = relationships.get(embed_id or "")
            if image_path:
                parts.append(f" [Hình: {os.path.basename(image_path)}] ")

    text = "".join(parts)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _extract_docx_text(docx: zipfile.ZipFile, xml_path: str, relationships: dict[str, str]) -> list[str]:
    try:
        root = ElementTree.fromstring(docx.read(xml_path))
    except Exception:
        return []

    chunks: list[str] = []
    body = root.find("w:body", WORD_NS)
    nodes = list(body) if body is not None else list(root)
    for node in nodes:
        tag = node.tag.rsplit("}", 1)[-1]
        if tag == "p":
            text = _docx_node_text(node, relationships)
            if text:
                chunks.append(text)
        elif tag == "tbl":
            rows: list[str] = []
            for row in node.findall(".//w:tr", WORD_NS):
                cells = [
                    _docx_node_text(cell, relationships)
                    for cell in row.findall("./w:tc", WORD_NS)
                ]
                cells = [cell for cell in cells if cell]
                if cells:
                    rows.append(" | ".join(cells))
            if rows:
                chunks.append("\n".join(rows))
    return chunks


def _extract_docx(file: ParserInputFile) -> PreparedSource:
    text_blocks: list[str] = []
    image_parts: list[dict[str, Any]] = []

    with zipfile.ZipFile(io.BytesIO(file.data)) as docx:
        relationships = _docx_relationships(docx)
        document_chunks = _extract_docx_text(docx, "word/document.xml", relationships)
        if document_chunks:
            text_blocks.append(f"--- {file.filename} DOCX text ---\n" + "\n".join(document_chunks))

        for extra_xml in sorted(
            name
            for name in docx.namelist()
            if re.fullmatch(r"word/(header|footer)\d+\.xml", name)
        ):
            chunks = _extract_docx_text(docx, extra_xml, relationships)
            if chunks:
                text_blocks.append(f"--- {file.filename} {extra_xml} text ---\n" + "\n".join(chunks))

        media_names = sorted(name for name in docx.namelist() if name.startswith("word/media/"))
        for media_name in media_names:
            if len(image_parts) >= MAX_IMAGE_PAGES:
                break
            content_type = _guess_content_type(media_name, "image/png")
            if not content_type.startswith("image/"):
                continue
            image_file = ParserInputFile(
                filename=f"{file.filename} embedded {os.path.basename(media_name)}",
                content_type=content_type,
                data=docx.read(media_name),
                source_url=file.source_url,
            )
            image_parts.extend(_extract_image_slices(image_file, content_type))
            image_parts = image_parts[:MAX_IMAGE_PAGES]

    return PreparedSource(text_blocks=text_blocks, image_parts=image_parts, source_files=[file.source_url or file.filename])


def _prepare_sources(
    *,
    text: str | None,
    files: list[ParserInputFile],
    page_range: str | None = None,
) -> PreparedSource:
    text_blocks: list[str] = []
    image_parts: list[dict[str, Any]] = []
    source_files: list[str] = []

    if text and text.strip():
        text_blocks.append(f"--- pasted text ---\n{text.strip()}")

    for file in files:
        content_type = file.content_type or _guess_content_type(file.filename)
        source_files.append(file.source_url or file.filename)
        if content_type == "application/pdf" or file.filename.lower().endswith(".pdf"):
            prepared_pdf = _extract_pdf_pages(file, page_range)
            source_files[-1] = prepared_pdf.source_files[0]
            text_blocks.extend(prepared_pdf.text_blocks)
            image_parts.extend(prepared_pdf.image_parts)
            continue

        if content_type == DOCX_MIME_TYPE or file.filename.lower().endswith(".docx"):
            prepared_docx = _extract_docx(file)
            text_blocks.extend(prepared_docx.text_blocks)
            image_parts.extend(prepared_docx.image_parts)
            continue

        if content_type.startswith("image/"):
            if len(image_parts) < MAX_IMAGE_PAGES:
                image_parts.extend(_extract_image_slices(file, content_type))
                image_parts = image_parts[:MAX_IMAGE_PAGES]
            continue

        try:
            decoded = file.data.decode("utf-8")
        except UnicodeDecodeError:
            decoded = file.data.decode("utf-8", errors="ignore")
        if decoded.strip():
            text_blocks.append(f"--- {file.filename} text ---\n{decoded.strip()}")

    return PreparedSource(text_blocks=text_blocks, image_parts=image_parts, source_files=source_files)


def fetch_remote_file(file_url: str) -> ParserInputFile:
    response = requests.get(file_url, timeout=60)
    response.raise_for_status()
    parsed = urlparse(file_url)
    filename = os.path.basename(parsed.path) or "remote-file"
    content_type = response.headers.get("content-type", "").split(";")[0]
    if not content_type:
        content_type = _guess_content_type(filename)
    return ParserInputFile(filename=filename, content_type=content_type, data=response.content, source_url=file_url)


def _build_prompt(
    *,
    grade: int,
    subject: str,
    language: str,
    question_set_title: str | None,
    prepared: PreparedSource,
) -> str:
    output_language = "Vietnamese" if language == "vi" else "English"
    text_context = "\n\n".join(prepared.text_blocks).strip() or "(No extracted text; read the attached images.)"
    source_files = ", ".join(prepared.source_files) or "text input"
    return f"""
You are a precise parser for Vietnamese grade {grade} math exams.
Your task is to read the provided exam pages and answer pages, then return a single JSON object.

Rules:
- Output language: {output_language}.
- Return valid JSON only. No markdown, no comments, no trailing text.
- Detect answer sections such as "ĐÁP ÁN", "HƯỚNG DẪN GIẢI", "LỜI GIẢI", and map each answer to the matching question.
- Extract EVERY visible question from EVERY exam page. Do not stop after the first page or first section.
- First reconstruct the full exam from OCR/image slice labels, then parse. If a page was split into slices, merge overlapping text and remove duplicated lines.
- Treat answer-only pages as answer keys, not as exam questions.
- Ignore administrative boxes such as "Giám thị", "Số phách", "Điểm", "Chữ ký", student name/class/SBD fields. They are not questions.
- Uploaded images may be out of order. Infer page order from headings, section names, and question numbers before extracting questions.
- If a question is split across two pages/images, merge the continuation into one question. Example: page 1 ends at "Câu 4..." and page 2 starts with text before options; combine them into Câu 4.
- If visible numbering implies a missing item, inspect the surrounding OCR/image slices again before returning. For example, if Câu 1, Câu 2, and Câu 4 are visible, recover Câu 3 instead of skipping it.
- For sections such as "Từ câu 1 đến câu 4", return all questions in that range when visible.
- For sections such as "Từ câu 5 đến câu 15", return every visible numbered short-answer question, even if the answer line is blank.
- Many Vietnamese exams restart numbering in "II. TỰ LUẬN"; keep the visible questionNumber, but still return each question as a separate item.
- If an answer is present in the document, set answerSource to "provided".
- If no answer is present, solve the problem yourself, set answerSource to "generated", and keep explanation short.
- Support question types: "multiple_choice", "short_answer", "essay".
- For multiple choice, answer is the option key (A/B/C/D) and answerText is the chosen option text when available.
- Preserve A/B/C/D choices exactly when they are visible in the source image or text.
- PDF text extraction can flatten stacked fractions incorrectly. If "math layout notes" list stacked vertical fractions, prefer those fractions over ambiguous plain text order. For example, numerator 5 above denominator 6 must be parsed as 5/6, not combined with the next numerator as 5/2.
- Sections named "Dạng 2", "điền khuyết", "ghi đáp số", or questions followed by "Đáp số:" are short_answer, not essay.
- For fill-in or numeric answer questions, use type "short_answer", choices must be [].
- Only use type "essay" for actual written-solution/free-response sections, not for "Đáp số" questions.
- Do not invent placeholder text like "...", "(câu hỏi bị cắt)", or "(phần đầu bị thiếu)" when the missing text is visible in another slice/page. Merge the continuation instead.
- For long-form questions with a/b/c/d items, use subQuestions.
- Do not include difficulty or skills.
- Keep explanations child-friendly and concise.
- Preserve original Vietnamese decimal commas.
- If a page is an image, keep its filename in imageUrls using the local label, not a fake URL.
- Fill visualDescription only when the question has a real diagram, chart, table, graph, geometric figure, or other image needed to solve it. Leave visualDescription empty for blank answer lines, dotted writing lines, score/signature boxes, decorative watermarks, or "no image" notes.

Return exactly this shape:
{{
  "questionSet": {{
    "title": "string",
    "grade": {grade},
    "subject": "{subject}",
    "language": "{language}",
    "sourceFiles": ["string"]
  }},
  "questions": [
    {{
      "id": "string",
      "questionSetId": "string",
      "grade": {grade},
      "subject": "{subject}",
      "section": "string",
      "questionNumber": 1,
      "type": "multiple_choice",
      "stem": "string",
      "choices": [{{"key": "A", "text": "string"}}],
      "subQuestions": [{{"label": "a", "stem": "string", "answerText": "string", "explanation": "string"}}],
      "answer": "string",
      "answerText": "string",
      "answerSource": "provided",
      "explanation": "string",
      "imageUrls": ["string"],
      "visualDescription": "string",
      "rawText": "string",
      "confidence": 0.0
    }}
  ]
}}

Question set title hint: {question_set_title or "(infer from source)"}.
Source files: {source_files}.

Extracted text:
{text_context}
""".strip()


def _build_repair_prompt(
    *,
    grade: int,
    subject: str,
    language: str,
    question_set_title: str | None,
    prepared: PreparedSource,
    initial_result: dict[str, Any],
) -> str:
    output_language = "Vietnamese" if language == "vi" else "English"
    text_context = "\n\n".join(prepared.text_blocks).strip() or "(No extracted text; read the attached images.)"
    return f"""
You are reviewing a previous JSON parse of a Vietnamese grade {grade} math exam.
The previous parse may have skipped questions near page bottoms, lost A/B/C/D choices, or mapped answer-key values imprecisely.

Repair rules:
- Output language: {output_language}.
- Return valid JSON only using the same schema as the previous JSON.
- Re-read ALL attached images/pages.
- Reconstruct the page from OCR/image slice labels. Merge overlapping slices and remove duplicated repeated lines.
- Include EVERY visible exam question, including short-answer questions and page-bottom questions.
- Treat pages titled "ĐÁP ÁN" as answer keys, not exam pages.
- Ignore administrative boxes such as score, proctor signatures, candidate info, and "Số phách".
- Uploaded pages may be out of order. Reconstruct order from question numbers and continuation text.
- Merge split questions across pages/images before returning JSON.
- If a previous item contains "...", "(câu hỏi bị cắt)", "(phần đầu bị thiếu)", or missing choices, recover that content from the attached slices instead of keeping the placeholder.
- If numbering jumps, recover the skipped visible question before returning.
- Questions in "Dạng 2: Câu hỏi điền khuyết" or with "Đáp số:" are type "short_answer", not "essay".
- Map the answer key exactly. If the answer key says "Câu 2 = A", answer must be "A" for Câu 2, with answerText set to option A when visible.
- Preserve multiple-choice options A/B/C/D whenever visible.
- PDF text extraction can flatten stacked fractions incorrectly. If "math layout notes" list stacked vertical fractions, prefer those fractions over ambiguous plain text order.
- Keep "difficulty" and "skills" out of the JSON.
- If no provided answer exists, solve it and set answerSource to "generated".
- Keep explanations short.

Question set title hint: {question_set_title or "(infer from source)"}.

Extracted text:
{text_context}

Previous JSON to repair:
{json.dumps(initial_result, ensure_ascii=False)}
""".strip()


def _call_openrouter(messages: list[dict[str, Any]], *, force_json: bool = True, model: str | None = None) -> str:
    payload = {
        "model": model or _parse_model_name(),
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 12000,
    }
    if force_json:
        payload["response_format"] = {"type": "json_object"}
    max_tokens = os.getenv("OPENROUTER_PARSE_MAX_TOKENS")
    if max_tokens:
        payload["max_tokens"] = int(max_tokens)

    for attempt in range(3):
        response = requests.post(
            OPENROUTER_URL,
            headers=_openrouter_headers(),
            json=payload,
            timeout=OPENROUTER_TIMEOUT_SECONDS,
        )
        if response.status_code == 200:
            data = response.json()
            return (data.get("choices", [{}])[0].get("message", {}).get("content", "") or "").strip()

        if response.status_code == 429 and attempt < 2:
            time.sleep(3)
            continue

        raise RuntimeError(f"OpenRouter parse failed: {response.status_code} - {response.text}")

    raise RuntimeError("OpenRouter parse failed after retries")


PROBLEM_JSON_SCHEMA_HINT = """
{
  "questionSet": {
    "title": "string",
    "grade": 5,
    "subject": "math",
    "language": "vi",
    "sourceFiles": ["string"]
  },
  "questions": [
    {
      "id": "string",
      "questionSetId": "string",
      "grade": 5,
      "subject": "math",
      "section": "string",
      "questionNumber": 1,
      "type": "multiple_choice | short_answer | essay",
      "stem": "string",
      "choices": [{"key": "A", "text": "string"}],
      "subQuestions": [{"label": "a", "stem": "string", "answerText": "string", "explanation": "string"}],
      "answer": "string",
      "answerText": "string",
      "answerSource": "provided | generated | unknown",
      "explanation": "string",
      "imageUrls": ["string"],
      "visualDescription": "string",
      "rawText": "string",
      "confidence": 0.8
    }
  ]
}
""".strip()

OCR_JSON_SCHEMA_HINT = """
{
  "pages": [
    {
      "label": "string",
      "role": "exam | answer_key | mixed | unknown",
      "pageHints": {
        "firstVisibleQuestion": "string",
        "lastVisibleQuestion": "string",
        "startsWithContinuation": false,
        "endsWithContinuation": false
      },
      "text": "string"
    }
  ]
}
""".strip()


def _extract_image_text_blocks(image_parts: list[dict[str, Any]], language: str) -> list[str]:
    blocks: list[str] = []
    output_language = "Vietnamese" if language == "vi" else "English"
    batch_size = max(1, OCR_BATCH_SIZE)
    for batch_start in range(0, len(image_parts), batch_size):
        batch = image_parts[batch_start : batch_start + batch_size]
        labels = "\n".join(f"- {image['label']}" for image in batch)
        prompt = f"""
Transcribe these Vietnamese grade-school math exam images accurately.
Some images are overlapping vertical slices from the same page. Treat every slice as important because long exam screenshots often lose questions near the middle or bottom.
Return valid JSON only:
{{
  "pages": [
    {{
      "label": "exact image/page label",
      "role": "exam | answer_key | mixed | unknown",
      "pageHints": {{
        "firstVisibleQuestion": "string",
        "lastVisibleQuestion": "string",
        "startsWithContinuation": true,
        "endsWithContinuation": true
      }},
      "text": "all visible exam text in this image/slice in reading order, preserving question numbers, A/B/C/D choices, tables, answers, and units"
    }}
  ]
}}

Rules:
- Do not solve anything.
- Ignore administrative form areas: school name blanks, student name/class/SBD fields, proctor/signature boxes, score boxes, "Số phách". Keep the exam title if visible.
- Transcribe every visible question and every visible answer option, including text at the very top/bottom of each image.
- Keep partial text when a slice starts or ends mid-question; do not replace it with "...".
- Preserve labels exactly so the next step can merge slices in order.
- If the top starts mid-sentence, include it and set startsWithContinuation true.
- If the bottom ends mid-question, include it and set endsWithContinuation true.
- Preserve Vietnamese decimal commas and units.
- Preserve answer-key tables exactly.
- Output explanation language is not needed; transcription text remains as seen.
- If the page is an answer page, role must be "answer_key".
- Target UI language: {output_language}.
Image labels:
{labels}
""".strip()
        content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
        for image in batch:
            content.append({"type": "text", "text": f"Image/page label: {image['label']}"})
            content.append(image["part"])

        raw = _call_openrouter(
            [{"role": "user", "content": content}],
            model=_ocr_model_name(),
        )
        try:
            parsed = _parse_json_object(raw)
        except Exception:
            try:
                parsed = _repair_json(raw, schema_hint=OCR_JSON_SCHEMA_HINT)
            except Exception:
                parsed = {"pages": [{"label": f"batch {batch_start + 1}", "role": "unknown", "text": raw}]}

        pages = parsed.get("pages") if isinstance(parsed, dict) else None
        if not isinstance(pages, list):
            pages = [parsed] if isinstance(parsed, dict) else []

        for index, page in enumerate(pages):
            if not isinstance(page, dict):
                continue
            fallback_label = batch[index]["label"] if index < len(batch) else f"batch {batch_start + 1}"
            label = str(page.get("label") or fallback_label).strip()
            page_text = str(page.get("text") or "").strip()
            if page_text:
                role = str(page.get("role") or "unknown").strip()
                blocks.append(f"--- OCR {label} ({role}) ---\n{page_text}")
    return blocks


def _slugify(value: str) -> str:
    value = value.strip().lower().replace("đ", "d")
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value[:96].strip("-") or "question-set"


def _question_id(question_set_id: str, question_number: int, question_index: int) -> str:
    suffix = f"cau-{question_number}" if question_number > 0 else f"cau-{question_index + 1}"
    return f"{question_set_id}-{suffix}-{question_index + 1}"


def _normalize_choice(choice: Any) -> dict[str, str] | None:
    if not isinstance(choice, dict):
        return None
    key = str(choice.get("key", "")).strip().upper()
    text = str(choice.get("text", "")).strip()
    if not key and not text:
        return None
    return {"key": key, "text": text}


def _normalize_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _normalize_sub_question(item: Any, index: int) -> dict[str, str] | None:
    if not isinstance(item, dict):
        return None
    label = str(item.get("label") or chr(ord("a") + index)).strip()
    stem = str(item.get("stem") or "").strip()
    answer_text = str(item.get("answerText") or item.get("answer") or "").strip()
    explanation = str(item.get("explanation") or "").strip()
    if not label and not stem and not answer_text and not explanation:
        return None
    return {
        "label": label,
        "stem": stem,
        "answerText": answer_text,
        "explanation": explanation,
    }


def _normalize_question(item: dict[str, Any], index: int, question_set_id: str, grade: int, subject: str) -> dict[str, Any]:
    question_type = item.get("type")
    if question_type not in {"multiple_choice", "short_answer", "essay"}:
        question_type = "multiple_choice" if item.get("choices") else "short_answer"

    choices = [
        choice
        for choice in (_normalize_choice(choice) for choice in item.get("choices", []))
        if choice is not None
    ]
    if question_type != "multiple_choice":
        choices = []

    section_text = str(item.get("section") or "")
    stem_text = str(item.get("stem") or "")
    raw_text = str(item.get("rawText") or "")
    type_signal = f"{section_text}\n{stem_text}\n{raw_text}".lower()
    has_fill_signal = any(
        signal in type_signal
        for signal in ["dạng 2", "dien khuyet", "điền khuyết", "ghi đáp số", "đáp số"]
    )
    if choices:
        question_type = "multiple_choice"
    elif has_fill_signal:
        question_type = "short_answer"

    question_number = item.get("questionNumber")
    if not isinstance(question_number, int):
        question_number = index + 1

    raw_id = str(item.get("id") or "").strip()
    slugged_raw_id = _slugify(raw_id) if raw_id and not raw_id.isdigit() else ""
    question_id = (
        slugged_raw_id
        if slugged_raw_id and slugged_raw_id != "question-set"
        else _question_id(question_set_id, question_number, index)
    )

    confidence = item.get("confidence", 0.8)
    try:
        confidence_value = max(0.0, min(1.0, float(confidence)))
    except (TypeError, ValueError):
        confidence_value = 0.0

    answer_source = item.get("answerSource")
    if answer_source not in {"provided", "generated", "unknown"}:
        answer_source = "unknown"

    sub_questions = [
        sub_question
        for sub_question in (
            _normalize_sub_question(sub_question, sub_index)
            for sub_index, sub_question in enumerate(item.get("subQuestions", []))
        )
        if sub_question is not None
    ]

    return {
        "id": question_id,
        "questionSetId": question_set_id,
        "grade": int(item.get("grade") or grade),
        "subject": str(item.get("subject") or subject),
        "section": str(item.get("section") or ""),
        "questionNumber": question_number,
        "type": question_type,
        "stem": str(item.get("stem") or "").strip(),
        "choices": choices,
        "subQuestions": sub_questions,
        "answer": str(item.get("answer") or "").strip(),
        "answerText": str(item.get("answerText") or "").strip(),
        "answerSource": answer_source,
        "explanation": str(item.get("explanation") or "").strip(),
        "imageUrls": _normalize_string_list(item.get("imageUrls")),
        "visualDescription": str(item.get("visualDescription") or "").strip(),
        "rawText": str(item.get("rawText") or "").strip(),
        "confidence": confidence_value,
    }


def _dedupe_question_ids(questions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: dict[str, int] = {}
    for index, question in enumerate(questions):
        question_id = str(question.get("id") or "").strip() or f"question-{index + 1}"
        question["id"] = question_id
        count = seen.get(question_id, 0) + 1
        seen[question_id] = count
        if count > 1:
            question["id"] = f"{question_id}-{count}"
    return questions


def normalize_parse_result(result: dict[str, Any], *, grade: int, subject: str, language: str, source_files: list[str]) -> dict[str, Any]:
    question_set = result.get("questionSet") if isinstance(result.get("questionSet"), dict) else {}
    title = str(question_set.get("title") or "Parsed math exam").strip()
    generated_id = _slugify(title)
    if generated_id == "question-set":
        generated_id = f"question-set-{hashlib.sha1('|'.join(source_files).encode('utf-8')).hexdigest()[:8]}"
    raw_question_set_id = str(question_set.get("id") or "").strip()
    slugged_raw_id = _slugify(raw_question_set_id) if raw_question_set_id and not raw_question_set_id.isdigit() else ""
    question_set_id = slugged_raw_id if slugged_raw_id != "question-set" else generated_id

    normalized_set = {
        "id": question_set_id,
        "title": title,
        "grade": int(question_set.get("grade") or grade),
        "subject": str(question_set.get("subject") or subject),
        "language": str(question_set.get("language") or language),
        "sourceFiles": _normalize_string_list(question_set.get("sourceFiles")) or source_files,
    }

    questions = result.get("questions", [])
    if not isinstance(questions, list):
        questions = []

    normalized_questions = [
        _normalize_question(item, index, question_set_id, grade, subject)
        for index, item in enumerate(questions)
        if isinstance(item, dict)
    ]

    return {
        "questionSet": normalized_set,
        "questions": _dedupe_question_ids(normalized_questions),
    }


def parse_problem_sources(
    *,
    text: str | None = None,
    files: list[ParserInputFile] | None = None,
    grade: int = 5,
    subject: str = "math",
    language: str = "vi",
    question_set_title: str | None = None,
    page_range: str | None = None,
) -> dict[str, Any]:
    prepared = _prepare_sources(text=text, files=files or [], page_range=page_range)
    if not prepared.text_blocks and not prepared.image_parts:
        raise ValueError("No text, PDF, or image content provided")

    use_ocr_transcript = False
    if prepared.image_parts and ENABLE_OCR_PASS:
        ocr_blocks = _extract_image_text_blocks(prepared.image_parts, language)
        if ocr_blocks:
            use_ocr_transcript = True
            prepared = PreparedSource(
                text_blocks=[*prepared.text_blocks, *ocr_blocks],
                image_parts=prepared.image_parts,
                source_files=prepared.source_files,
            )

    prompt = _build_prompt(
        grade=grade,
        subject=subject,
        language=language,
        question_set_title=question_set_title,
        prepared=prepared,
    )

    # Once OCR has produced a transcript, parse scanned pages from text only.
    # DOCX embedded figures are usually small diagrams tied to text questions, so
    # keep them available for the final parse.
    has_embedded_figures = any(" embedded " in str(image.get("label", "")) for image in prepared.image_parts)
    final_image_parts = prepared.image_parts if (has_embedded_figures or not use_ocr_transcript) else []
    content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
    for image in final_image_parts:
        content.append({"type": "text", "text": f"Image/page label: {image['label']}"})
        content.append(image["part"])

    raw = _call_openrouter([{"role": "user", "content": content}])
    try:
        parsed = _parse_json_object(raw)
    except Exception:
        parsed = _repair_json(raw, schema_hint=PROBLEM_JSON_SCHEMA_HINT)
    normalized = normalize_parse_result(
        parsed,
        grade=grade,
        subject=subject,
        language=language,
        source_files=prepared.source_files,
    )

    if prepared.image_parts and ENABLE_REPAIR_PASS:
        repair_prompt = _build_repair_prompt(
            grade=grade,
            subject=subject,
            language=language,
            question_set_title=question_set_title,
            prepared=prepared,
            initial_result=normalized,
        )
        repair_content: list[dict[str, Any]] = [{"type": "text", "text": repair_prompt}]
        for image in prepared.image_parts:
            repair_content.append({"type": "text", "text": f"Image/page label: {image['label']}"})
            repair_content.append(image["part"])

        repaired_raw = _call_openrouter([{"role": "user", "content": repair_content}])
        try:
            repaired_json = _parse_json_object(repaired_raw)
        except Exception:
            repaired_json = _repair_json(repaired_raw, schema_hint=PROBLEM_JSON_SCHEMA_HINT)
        repaired = normalize_parse_result(
            repaired_json,
            grade=grade,
            subject=subject,
            language=language,
            source_files=prepared.source_files,
        )
        if len(repaired["questions"]) >= len(normalized["questions"]):
            return repaired

    return normalized


def parse_problem_sources_batch(
    *,
    text: str | None = None,
    files: list[ParserInputFile] | None = None,
    grade: int = 5,
    subject: str = "math",
    language: str = "vi",
    question_set_title: str | None = None,
    page_range: str | None = None,
    skip_first_set: bool = False,
) -> dict[str, Any]:
    source_files = files or []
    pdf_file = next(
        (
            file
            for file in source_files
            if (file.content_type or _guess_content_type(file.filename)) == "application/pdf"
            or file.filename.lower().endswith(".pdf")
        ),
        None,
    )
    if not pdf_file:
        single = parse_problem_sources(
            text=text,
            files=source_files,
            grade=grade,
            subject=subject,
            language=language,
            question_set_title=question_set_title,
            page_range=page_range,
        )
        return {"mode": "batch", "sets": [{"label": single["questionSet"]["title"], "pageRange": "", **single}]}

    ranges = detect_pdf_exam_ranges(pdf_file, skip_first=skip_first_set, page_range=page_range)
    if not ranges:
        single = parse_problem_sources(
            text=text,
            files=source_files,
            grade=grade,
            subject=subject,
            language=language,
            question_set_title=question_set_title,
            page_range=page_range,
        )
        return {"mode": "batch", "sets": [{"label": single["questionSet"]["title"], "pageRange": "", **single}]}

    sets: list[dict[str, Any]] = []
    used_ids: set[str] = set()
    for exam in ranges:
        title_hint = question_set_title
        if title_hint:
            title_hint = f"{title_hint} - {exam['label']}"
        result = parse_problem_sources(
            text=text,
            files=source_files,
            grade=grade,
            subject=subject,
            language=language,
            question_set_title=title_hint or exam["label"],
            page_range=exam["pageRange"],
        )
        question_set = result["questionSet"]
        original_id = _slugify(str(question_set.get("title") or question_set.get("id") or exam["label"]))
        if original_id in used_ids:
            original_id = f"{original_id}-{_slugify(exam['pageRange'])}"
        used_ids.add(original_id)
        question_set["id"] = original_id
        for question_index, question in enumerate(result["questions"]):
            question["questionSetId"] = original_id
            question["id"] = _question_id(original_id, int(question.get("questionNumber") or 0), question_index)
        sets.append(
            {
                "label": exam["label"],
                "pageRange": exam["pageRange"],
                "questionSet": question_set,
                "questions": result["questions"],
            }
        )

    return {"mode": "batch", "sets": sets}
