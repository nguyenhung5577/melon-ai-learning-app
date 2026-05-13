import json
import os
import time
from typing import Any

import requests
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))
LLM_MAX_TOKENS_EXERCISE = int(os.getenv("LLM_MAX_TOKENS_EXERCISE", "1400"))
LLM_MAX_TOKENS_GUIDANCE = int(os.getenv("LLM_MAX_TOKENS_GUIDANCE", "500"))


def _llm_provider() -> str:
    if os.getenv("OPENAI_API_KEY"):
        return "openai"
    return "openrouter"


def _call_chat_completion(
    messages: list[dict[str, str]],
    retries: int = 3,
    temperature: float = 0.25,
    max_tokens: int | None = None,
) -> str:
    provider = _llm_provider()
    for attempt in range(retries):
        if provider == "openai":
            model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
            headers = {
                "Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}",
                "Content-Type": "application/json",
            }
            payload: dict[str, Any] = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "response_format": {"type": "json_object"},
            }
            if max_tokens:
                payload["max_tokens"] = max_tokens
            url = "https://api.openai.com/v1/chat/completions"
        else:
            model = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
            headers = {
                "Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY')}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "response_format": {"type": "json_object"},
            }
            if max_tokens:
                payload["max_tokens"] = max_tokens
            url = "https://openrouter.ai/api/v1/chat/completions"

        response = requests.post(url, headers=headers, json=payload, timeout=60)
        if response.status_code == 200:
            result = response.json()
            return (result.get("choices", [{}])[0].get("message", {}).get("content", "") or "").strip()

        if response.status_code == 429:
            retry_after = 3
            try:
                retry_after = response.json().get("error", {}).get("metadata", {}).get("retry_after_seconds", 3)
            except Exception:
                pass
            time.sleep(retry_after)
            continue

        if attempt == retries - 1:
            raise RuntimeError(f"LLM request failed ({provider}): {response.status_code} - {response.text}")

    raise RuntimeError("LLM request failed after retries")


def _parse_json_object(raw: str) -> dict[str, Any]:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Light guard for models that may wrap JSON in text.
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(raw[start:end + 1])
        raise


def generate_lesson_content(topic: str, context: str) -> list[dict[str, Any]]:
    return generate_exercise_questions(topic=topic, context=context, count=2, difficulty="easy")


def generate_exercise_questions(
    topic: str,
    context: str,
    count: int = 10,
    difficulty: str = "medium",
) -> list[dict[str, Any]]:
    grounded_context = context.strip()
    if not grounded_context:
        return []

    prompt = f"""
You are a strict question writer for children aged 6-14.
Task: create exactly {count} multiple-choice questions for topic "{topic}" at "{difficulty}" level.

IMPORTANT GROUNDING RULES:
1) Every question MUST be directly supported by the reference context below.
2) Do NOT use outside knowledge, assumptions, or generic textbook facts not in context.
3) Each question must include a short evidence quote copied from context (5-20 words).
4) If context is insufficient, still create questions only from available lines (do not invent).
5) Keep language kid-friendly and clear.

Return ONLY valid JSON:
{{
  "questions": [
    {{
      "question": "string",
      "choices": {{
        "A": "string",
        "B": "string",
        "C": "string",
        "D": "string"
      }},
      "answer": "A",
      "explanation": "short explanation for why answer is correct based on context",
      "evidence_quote": "exact short quote from context"
    }}
  ]
}}

Reference context:
{grounded_context}
"""
    raw = _call_chat_completion(
        [{"role": "user", "content": prompt}],
        temperature=0.15,
        max_tokens=LLM_MAX_TOKENS_EXERCISE,
    )
    parsed = _parse_json_object(raw)
    questions = parsed.get("questions", [])
    if not isinstance(questions, list):
        return []
    return questions


def generate_exercise_guidance(
    question: str,
    student_answer: str | None,
    correct_answer: str | None,
    context: str = "",
) -> str:
    prompt = f"""
You are a friendly AI tutor for kids.
Explain how to solve the exercise step by step in 3-5 short sentences.
Be encouraging, simple, and practical.

Exercise question:
{question}

Student answer:
{student_answer or "Not provided"}

Correct answer:
{correct_answer or "Not provided"}

Reference context:
{context}

Return ONLY valid JSON:
{{
  "guidance": "your guidance text"
}}
"""
    raw = _call_chat_completion(
        [{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=LLM_MAX_TOKENS_GUIDANCE,
    )
    parsed = _parse_json_object(raw)
    guidance = parsed.get("guidance", "")
    return guidance if isinstance(guidance, str) and guidance.strip() else "Let's solve this together step by step!"

