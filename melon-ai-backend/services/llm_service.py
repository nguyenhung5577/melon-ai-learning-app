import os
import requests
import re
import time
import json

API_KEY = os.getenv("OPENROUTER_API_KEY")

URL = "https://openrouter.ai/api/v1/chat/completions"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}


def call_openrouter(prompt: str, retries: int = 3) -> str:
    for model in ["openai/gpt-4o-mini"]:
        for attempt in range(retries):
            payload = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}]
            }

            response = requests.post(URL, headers=HEADERS, data=json.dumps(payload))

            if response.status_code == 200:
                result = response.json()
                if result.get("choices"):
                    print(f"[INFO] Success with model: {model}")
                    return result["choices"][0]["message"]["content"].strip()

            elif response.status_code == 429:
                retry_after = response.json().get("error", {}) \
                    .get("metadata", {}).get("retry_after_seconds", 5)
                print(f"[WARN] 429 on {model}, retrying in {retry_after}s... (attempt {attempt+1}/{retries})")
                time.sleep(retry_after)

            else:
                print(f"[WARN] {response.status_code} on {model}: {response.text}, skipping.")
                break

        print(f"[WARN] All retries exhausted for {model}, trying next...")

    print("[ERROR] All models failed.")
    return ""


def parse_mcq(raw: str) -> list:
    questions = []
    blocks = re.split(r"\n(?=Q:)", raw.strip())

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        q_match = re.search(r"Q:\s*(.+)", block)
        choices_match = re.findall(r"([A-D])\)\s*(.+)", block)
        answer_match = re.search(r"Answer:\s*([A-D])", block)

        if not q_match or len(choices_match) < 2 or not answer_match:
            print(f"[WARN] Skipping malformed block:\n{block}")
            continue

        questions.append({
            "question": q_match.group(1).strip(),
            "choices": {letter: text.strip() for letter, text in choices_match},
            "answer": answer_match.group(1).strip()
        })

    if not questions:
        print("[WARN] Parsing failed, returning raw text.")
        return [{"question": "Raw output", "choices": {}, "answer": raw}]

    return questions


def generate_lesson_content(topic: str, context: str) -> list:
    prompt = f"""You are an educational assistant for kids.
Based on the following context, create 1-2 multiple choice questions about '{topic}'.
Format each question strictly as:

Q: <question>
A) <choice>
B) <choice>
C) <choice>
D) <choice>
Answer: <correct letter>

Context:
{context}"""

    raw = call_openrouter(prompt)
    print(f"[DEBUG] Raw output:\n{raw}\n")

    if not raw:
        return []

    return parse_mcq(raw)

