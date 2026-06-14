/**
 * AI Rubric Classifier — classifies math questions into 4 rubric levels
 * using OpenRouter (GPT-4o) based on Bloom's taxonomy for Vietnamese Math grades 4–5.
 *
 * Levels:
 *   nhan_biet    — Nhận biết  (Knowledge / Recall)
 *   thong_hieu   — Thông hiểu (Comprehension)
 *   van_dung     — Vận dụng   (Application)
 *   van_dung_cao — Vận dụng cao (Analysis / Synthesis / Evaluation)
 */

import OpenAI from "openai";
import type { RubricLevel } from "./types";

/* ---------- types ---------- */

export interface ClassificationResult {
  questionId: string;
  rubricLevel: RubricLevel;
  confidence: number;
  reasoning: string;
}

export interface ClassifyProgress {
  type: "progress" | "complete" | "error";
  classified: number;
  total: number;
  current?: ClassificationResult;
  error?: string;
}

/* ---------- prompt ---------- */

const RUBRIC_SYSTEM_PROMPT = `Bạn là chuyên gia giáo dục Toán tiểu học Việt Nam (lớp 4–5). Nhiệm vụ: phân loại câu hỏi Toán theo 4 cấp độ nhận thức Bloom.

## CẤP ĐỘ PHÂN LOẠI

### 1. nhan_biet — Nhận biết
Yêu cầu nhớ lại, nhận dạng kiến thức đã học.
- Nhận dạng hình học cơ bản (hình vuông, hình chữ nhật, hình tròn…)
- Đọc, viết, so sánh số
- Nhắc lại công thức, quy tắc
- Tính toán 1 bước đơn giản (cộng, trừ, nhân, chia trực tiếp)
- Đổi đơn vị đo đơn giản (1 bước)
- Nhận dạng phân số, số thập phân

### 2. thong_hieu — Thông hiểu
Yêu cầu hiểu ý nghĩa, giải thích, áp dụng trực tiếp vào bài quen thuộc.
- Giải thích vì sao, chứng minh đơn giản
- Áp dụng trực tiếp công thức (chu vi, diện tích, thể tích) vào bài đã biết dạng
- Tính toán 2 bước
- So sánh, sắp xếp với lý giải
- Đọc bảng/biểu đồ và trả lời câu hỏi trực tiếp

### 3. van_dung — Vận dụng
Yêu cầu áp dụng kiến thức vào tình huống mới hoặc bài toán thực tế.
- Bài toán có lời văn thực tế (mua bán, đo đạc, thời gian…)
- Kết hợp nhiều kiến thức/phép tính (3+ bước)
- Bài toán tìm x với phương trình đơn giản
- Bài toán hình học cần suy luận (tính cạnh rồi mới tính diện tích)
- Bài toán tỉ lệ, trung bình cộng có ngữ cảnh

### 4. van_dung_cao — Vận dụng cao
Yêu cầu phân tích, tổng hợp, sáng tạo, giải quyết vấn đề phức tạp.
- Bài toán nhiều bước phức tạp, cần lập luận logic chặt chẽ
- Bài toán có nhiều cách giải, cần chọn cách tối ưu
- Bài toán mở, không có khuôn mẫu sẵn
- Bài toán đố, bài toán nâng cao, olympiad
- Bài toán kết hợp nhiều chủ đề (hình học + số học + đo lường)
- Bài toán yêu cầu giải thích chiến lược, phản biện

## QUY TẮC
1. Chỉ trả về JSON, KHÔNG giải thích thêm ngoài JSON.
2. Nếu câu hỏi không rõ ràng hoặc không đủ thông tin, đặt confidence thấp (< 0.5).
3. Phân loại dựa trên YÊU CẦU NHẬN THỨC của câu hỏi, không phải độ dài.
4. Một câu hỏi ngắn vẫn có thể là vận dụng cao nếu yêu cầu tư duy sâu.`;

const CLASSIFY_USER_PROMPT = (
  rawText: string,
  stem: string,
  grade: number,
  section: string,
  questionType: string,
) => `Phân loại câu hỏi Toán lớp ${grade} sau:

Phần: ${section}
Loại: ${questionType === "multiple_choice" ? "Trắc nghiệm" : questionType === "short_answer" ? "Điền đáp số" : "Tự luận"}
Nội dung gốc:
"""
${rawText || stem}
"""
${stem && stem !== rawText ? `\nĐề bài đã xử lý:\n"""\n${stem}\n"""` : ""}

Trả về JSON duy nhất:
{"rubricLevel": "nhan_biet" | "thong_hieu" | "van_dung" | "van_dung_cao", "confidence": 0.0-1.0, "reasoning": "Giải thích ngắn gọn vì sao chọn cấp độ này"}`;

/* ---------- client ---------- */

function getOpenRouterClient(): OpenAI {
  const key = process.env.OPENROUTER_API_KEY ?? "";
  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY chưa được cấu hình trong .env.local",
    );
  }
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: key,
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "Melon AI Learning",
    },
  });
}

/* ---------- single question ---------- */

const VALID_LEVELS: RubricLevel[] = [
  "nhan_biet",
  "thong_hieu",
  "van_dung",
  "van_dung_cao",
];

// GPT-4o via OpenRouter — cheap and accurate enough for classification
const MODEL = "openai/gpt-4o";

export async function classifyQuestion(
  questionId: string,
  rawText: string,
  stem: string,
  grade: number,
  section: string,
  questionType: string,
): Promise<ClassificationResult> {
  const client = getOpenRouterClient();

  const completion = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 300,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: RUBRIC_SYSTEM_PROMPT },
      {
        role: "user",
        content: CLASSIFY_USER_PROMPT(rawText, stem, grade, section, questionType),
      },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim() ?? "";

  // Strip markdown fences if present
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);

  if (!match) {
    console.warn(`[rubric-classifier] Empty/unparseable response for question ${questionId}:`, text);
    return {
      questionId,
      rubricLevel: "unclassified",
      confidence: 0,
      reasoning: "Không parse được response từ AI",
    };
  }

  try {
    const parsed = JSON.parse(match[0]) as {
      rubricLevel?: string;
      confidence?: number;
      reasoning?: string;
    };

    const level = VALID_LEVELS.includes(parsed.rubricLevel as RubricLevel)
      ? (parsed.rubricLevel as RubricLevel)
      : "unclassified";

    return {
      questionId,
      rubricLevel: level,
      confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
      reasoning: parsed.reasoning ?? "",
    };
  } catch {
    console.warn(`[rubric-classifier] JSON parse error for question ${questionId}:`, text);
    return {
      questionId,
      rubricLevel: "unclassified",
      confidence: 0,
      reasoning: "JSON parse error từ AI response",
    };
  }
}

/* ---------- batch ---------- */

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 500; // OpenRouter is faster, lower delay

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function* classifyBatch(
  questions: {
    id: string;
    rawText: string;
    stem: string;
    grade: number;
    section: string;
    type: string;
  }[],
): AsyncGenerator<ClassifyProgress> {
  const total = questions.length;
  let classified = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map((q) =>
        classifyQuestion(q.id, q.rawText, q.stem, q.grade, q.section, q.type),
      ),
    );

    for (let j = 0; j < results.length; j++) {
      classified++;
      const result = results[j];

      if (result.status === "fulfilled") {
        yield {
          type: "progress",
          classified,
          total,
          current: result.value,
        };
      } else {
        yield {
          type: "error",
          classified,
          total,
          error: `Lỗi câu ${batch[j].id}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
        };
      }
    }

    // Rate-limit between batches
    if (i + BATCH_SIZE < total) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  yield { type: "complete", classified, total };
}
