import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { adminAuth, adminDb } from "@/lib/server/firebase-admin";
import type { RubricLevel } from "@/lib/problems/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/* ---------- constants ---------- */

const RUBRIC_LEVELS: RubricLevel[] = [
  "nhan_biet",
  "thong_hieu",
  "van_dung",
  "van_dung_cao",
];

const RUBRIC_LABELS: Record<string, string> = {
  nhan_biet: "Nhận biết",
  thong_hieu: "Thông hiểu",
  van_dung: "Vận dụng",
  van_dung_cao: "Vận dụng cao",
};

const MODEL = "openai/gpt-4o";
const LOOKBACK_DAYS = 7;
const TARGET_QUESTION_COUNT = 10;

/* ---------- helpers ---------- */

function getOpenRouterClient(): OpenAI {
  const key = process.env.OPENROUTER_API_KEY ?? "";
  if (!key) {
    throw new Error("OPENROUTER_API_KEY chưa được cấu hình trong .env.local");
  }
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: key,
    defaultHeaders: {
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "Melon AI Learning",
    },
  });
}

function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

function nextRubricLevel(current: string): RubricLevel {
  const idx = RUBRIC_LEVELS.indexOf(current as RubricLevel);
  if (idx < 0 || idx >= RUBRIC_LEVELS.length - 1) return "van_dung_cao";
  return RUBRIC_LEVELS[idx + 1];
}

interface AttemptRecord {
  questionId: string;
  isCorrect: boolean;
  rubricLevel: string;
  concepts: string[];
  skills: string[];
  submittedAt: string;
  subject: string;
  grade: number;
  stem?: string;
  answer?: string;
  answerText?: string;
  choices?: Array<{ key: string; text: string }>;
  type?: string;
  section?: string;
}

/* ---------- main ---------- */

export async function POST(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json(
      { error: "Missing auth token." },
      { status: 401 },
    );
  }

  try {
    const auth = adminAuth();
    const db = adminDb();
    const decoded = await auth.verifyIdToken(token);
    const kidUid = decoded.uid;

    // Verify kid account
    const userSnap = await db.collection("users").doc(kidUid).get();
    if (!userSnap.exists || userSnap.data()?.role !== "kid") {
      return NextResponse.json(
        { error: "Only kid accounts can generate practice sets." },
        { status: 403 },
      );
    }

    // Check if the kid has already generated a set today (Vietnam timezone UTC+7)
    const existingSetsSnap = await db
      .collection("generatedQuestionSets")
      .where("childUid", "==", kidUid)
      .get();
    
    const hasTodaySet = existingSetsSnap.docs.some((doc) => {
      const data = doc.data();
      if (!data.createdAt) return false;
      const createdDate = new Date(data.createdAt);
      // Convert to Vietnam timezone
      const createdDateVN = new Date(createdDate.getTime() + 7 * 60 * 60 * 1000);
      const nowVN = new Date(Date.now() + 7 * 60 * 60 * 1000);
      return (
        createdDateVN.getUTCFullYear() === nowVN.getUTCFullYear() &&
        createdDateVN.getUTCMonth() === nowVN.getUTCMonth() &&
        createdDateVN.getUTCDate() === nowVN.getUTCDate()
      );
    });

    if (hasTodaySet) {
      return NextResponse.json(
        { error: "Mỗi ngày con chỉ được thiết kế tối đa 1 đề ôn tập. Hãy luyện tập thật tốt đề đã được tạo nhé!" },
        { status: 429 },
      );
    }

    // 1. Load child profile
    const childSnap = await db.collection("children").doc(kidUid).get();
    const child = childSnap.data() ?? {};
    const grade = child.learningPreferences?.gradeLevel === "grade_4" ? 4 : 5;

    // 2. Load student progress
    const progressSnap = await db
      .collection("studentProgress")
      .doc(kidUid)
      .get();
    const progress = progressSnap.data() ?? {};
    const exerciseAccuracy = Number(progress.exerciseAccuracy ?? 0);
    const weakConcepts: string[] = progress.weakConcepts ?? [];

    // 3. Load personalized plan (active only)
    const planQuery = await db
      .collection("studentPersonalizedPlans")
      .where("childUid", "==", kidUid)
      .where("status", "==", "active")
      .limit(1)
      .get();
    const plan = planQuery.empty ? null : planQuery.docs[0].data();
    const planId = planQuery.empty ? null : planQuery.docs[0].id;
    const targetConcepts: string[] =
      plan?.targetConcepts ?? weakConcepts ?? [];

    // 4. Load recent exercise attempts (last 7 days) — practice/exam only
    const cutoff = new Date(
      Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const attemptsQuery = await db
      .collection("studentExerciseAttempts")
      .where("childUid", "==", kidUid)
      .where("submittedAt", ">=", cutoff)
      .orderBy("submittedAt", "desc")
      .limit(200)
      .get();

    // Deduplicate: keep only the latest attempt per questionId
    const latestByQuestion = new Map<string, AttemptRecord>();
    for (const doc of attemptsQuery.docs) {
      const data = doc.data();
      if (!latestByQuestion.has(data.questionId)) {
        latestByQuestion.set(data.questionId, {
          questionId: data.questionId,
          isCorrect: Boolean(data.isCorrect),
          rubricLevel: data.rubricLevel ?? "unclassified",
          concepts: data.concepts ?? [],
          skills: data.skills ?? [],
          submittedAt: data.submittedAt,
          subject: data.subject ?? "math",
          grade: data.grade ?? grade,
        });
      }
    }

    const wrongAttempts = [...latestByQuestion.values()].filter(
      (a) => !a.isCorrect,
    );
    const correctAttempts = [...latestByQuestion.values()].filter(
      (a) => a.isCorrect,
    );

    // 5. Enrich attempts with question content from questionBank
    const allQuestionIds = [
      ...wrongAttempts.map((a) => a.questionId),
      ...correctAttempts.map((a) => a.questionId),
    ].slice(0, 30); // cap to avoid huge reads

    if (allQuestionIds.length > 0) {
      // Firestore `in` queries support max 30 elements
      const chunks: string[][] = [];
      for (let i = 0; i < allQuestionIds.length; i += 30) {
        chunks.push(allQuestionIds.slice(i, i + 30));
      }
      for (const chunk of chunks) {
        const qSnap = await db
          .collection("questionBank")
          .where("__name__", "in", chunk)
          .get();
        for (const doc of qSnap.docs) {
          const q = doc.data();
          const attempt = latestByQuestion.get(doc.id);
          if (attempt) {
            attempt.stem = q.stem;
            attempt.answer = q.answer;
            attempt.answerText = q.answerText;
            attempt.choices = q.choices;
            attempt.type = q.type;
            attempt.section = q.section;
            attempt.rubricLevel = q.rubricLevel ?? attempt.rubricLevel;
            attempt.concepts = q.concepts ?? attempt.concepts;
            attempt.skills = q.skills ?? attempt.skills;
          }
        }
      }
    }

    // 6. Build LLM prompt
    const wrongSample = wrongAttempts.filter((a) => a.stem).slice(0, 5);
    const correctSample = correctAttempts.filter((a) => a.stem).slice(0, 5);

    const wrongSection = wrongSample
      .map(
        (a, i) =>
          `${i + 1}. [CẦN ÔN LẠI — ${RUBRIC_LABELS[a.rubricLevel] ?? a.rubricLevel}]
   Câu hỏi gốc: "${a.stem}"
   Đáp án đúng: "${a.answerText || a.answer}"
   Concepts: ${a.concepts.join(", ") || "không rõ"}
   → Hãy tạo 1 câu tương tự cùng dạng (${a.type ?? "short_answer"}), cùng cấp độ ${RUBRIC_LABELS[a.rubricLevel] ?? a.rubricLevel}, nhưng thay đổi dữ kiện/số liệu.`,
      )
      .join("\n\n");

    const correctSection = correctSample
      .map(
        (a, i) =>
          `${i + 1}. [NÂNG CẤP — từ ${RUBRIC_LABELS[a.rubricLevel] ?? a.rubricLevel} lên ${RUBRIC_LABELS[nextRubricLevel(a.rubricLevel)]}]
   Câu hỏi gốc: "${a.stem}"
   Concepts: ${a.concepts.join(", ") || "không rõ"}
   → Hãy tạo 1 câu nâng cấp lên cấp độ ${RUBRIC_LABELS[nextRubricLevel(a.rubricLevel)]}, cùng concept nhưng yêu cầu tư duy cao hơn.`,
      )
      .join("\n\n");

    const totalFromLogs = wrongSample.length + correctSample.length;
    const fillCount = Math.max(0, TARGET_QUESTION_COUNT - totalFromLogs);

    const fillSection =
      fillCount > 0
        ? `\n\nNgoài ra, hãy tạo thêm ${fillCount} câu hỏi Toán lớp ${grade} bổ sung, ưu tiên các concepts: ${targetConcepts.slice(0, 5).join(", ") || "tổng hợp"}, phân bố đều cấp độ từ nhận biết đến vận dụng.`
        : "";

    const systemPrompt = `Bạn là giáo viên Toán tiểu học Việt Nam chuyên soạn đề kiểm tra Toán lớp 4 và lớp 5.
Nhiệm vụ: Sinh ra đúng ${TARGET_QUESTION_COUNT} câu hỏi Toán lớp ${grade} dưới dạng JSON array.

Mỗi câu hỏi phải có cấu trúc JSON sau:
{
  "questionNumber": <số thứ tự 1..${TARGET_QUESTION_COUNT}>,
  "type": "multiple_choice" hoặc "short_answer",
  "rubricLevel": "nhan_biet" | "thong_hieu" | "van_dung" | "van_dung_cao",
  "stem": "<nội dung câu hỏi>",
  "choices": [{"key": "A", "text": "..."}, ...] (chỉ khi type=multiple_choice, phải có 4 lựa chọn A/B/C/D),
  "answer": "<đáp án đúng, VD: B hoặc số>",
  "answerText": "<nội dung đáp án đúng>",
  "explanation": "<giải thích ngắn cách giải>",
  "concepts": ["<concept 1>", ...],
  "section": "Trắc nghiệm" hoặc "Tự luận",
  "sourceHint": "<ghi chú: câu này ôn lại/nâng cấp từ câu nào hoặc tạo mới>"
}

QUY TẮC:
- Trả về MỘT JSON ARRAY duy nhất chứa đúng ${TARGET_QUESTION_COUNT} objects, không có text nào khác.
- Nội dung phải phù hợp chương trình Toán tiểu học Việt Nam.
- Số liệu phải hợp lý, đáp án phải đúng.
- Mỗi câu trắc nghiệm phải có đúng 4 lựa chọn A, B, C, D.
- Câu tự luận (short_answer) chỉ cần stem + answer + answerText.`;

    const userPrompt = `Đây là phân tích kết quả làm bài gần đây của học sinh lớp ${grade}:
- Tỉ lệ đúng tổng: ${exerciseAccuracy.toFixed(1)}%
- Concepts yếu: ${targetConcepts.slice(0, 8).join(", ") || "chưa xác định"}
- Số câu làm sai gần đây: ${wrongAttempts.length}
- Số câu làm đúng gần đây: ${correctAttempts.length}

${wrongSection ? `## PHẦN 1: Câu cần ôn lại (tạo câu tương tự)\n\n${wrongSection}` : ""}

${correctSection ? `## PHẦN 2: Câu cần nâng cấp độ khó\n\n${correctSection}` : ""}
${fillSection}

Hãy tạo đúng ${TARGET_QUESTION_COUNT} câu hỏi dưới dạng JSON array.`;

    // 7. Call LLM
    const client = getOpenRouterClient();
    const completion = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 4000,
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const rawResponse =
      completion.choices[0]?.message?.content?.trim() ?? "[]";

    // 8. Parse LLM response
    let generatedQuestions: Array<Record<string, unknown>>;
    try {
      // Strip markdown code fences if present
      const cleaned = rawResponse
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      generatedQuestions = JSON.parse(cleaned);
      if (!Array.isArray(generatedQuestions)) {
        throw new Error("Response is not an array");
      }
    } catch {
      return NextResponse.json(
        {
          error: "Không đọc được kết quả từ AI. Vui lòng thử lại.",
          rawResponse,
        },
        { status: 500 },
      );
    }

    // 9. Write to Firestore
    const now = new Date().toISOString();
    const setId = `gen_${kidUid}_${Date.now()}`;
    const questionIds: string[] = [];
    const rubricDistribution: Record<string, number> = {};
    const sourceQuestionIds: string[] = [
      ...wrongSample.map((a) => a.questionId),
      ...correctSample.map((a) => a.questionId),
    ];

    const batch = db.batch();

    for (let i = 0; i < generatedQuestions.length; i++) {
      const q = generatedQuestions[i];
      const qId = `${setId}_q${i + 1}`;
      const rubric = String(q.rubricLevel ?? "unclassified");
      rubricDistribution[rubric] = (rubricDistribution[rubric] ?? 0) + 1;

      const choices = Array.isArray(q.choices)
        ? (q.choices as Array<{ key: string; text: string }>).map((c) => ({
            key: String(c.key ?? ""),
            text: String(c.text ?? ""),
          }))
        : [];

      const questionDoc = {
        id: qId,
        childUid: kidUid,
        generatedSetId: setId,
        questionSetId: setId,
        grade,
        subject: "math",
        section: String(q.section ?? "Tự luận"),
        questionNumber: Number(q.questionNumber ?? i + 1),
        type: String(q.type ?? "short_answer"),
        stem: String(q.stem ?? ""),
        choices,
        subQuestions: [],
        answer: String(q.answer ?? ""),
        answerText: String(q.answerText ?? ""),
        answerSource: "generated" as const,
        explanation: String(q.explanation ?? ""),
        imageUrls: [],
        visualDescription: "",
        rawText: String(q.stem ?? ""),
        confidence: 0.85,
        rubricLevel: rubric,
        concepts: Array.isArray(q.concepts)
          ? q.concepts.map(String)
          : [],
        skills: [],
        sourceQuestionId: String(q.sourceHint ?? ""),
        createdAt: now,
        updatedAt: now,
      };

      batch.set(db.collection("generatedQuestions").doc(qId), questionDoc);
      questionIds.push(qId);
    }

    const setDoc = {
      id: setId,
      childUid: kidUid,
      title: `Đề ôn tập cá nhân — ${new Date().toLocaleDateString("vi-VN")}`,
      grade,
      subject: "math",
      questionIds,
      questionCount: questionIds.length,
      status: "ready",
      createdAt: now,
      updatedAt: now,
      generationMeta: {
        basedOnPlanId: planId,
        targetConcepts: targetConcepts.slice(0, 10),
        rubricDistribution,
        exerciseAccuracyAtGen: exerciseAccuracy,
        sourceQuestionIds,
        generatedAt: now,
      },
    };

    batch.set(db.collection("generatedQuestionSets").doc(setId), setDoc);
    await batch.commit();

    return NextResponse.json({
      success: true,
      generatedSet: setDoc,
      questionCount: questionIds.length,
    });
  } catch (error) {
    console.error("Smart set generation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể tạo đề ôn tập. Vui lòng thử lại.",
      },
      { status: 500 },
    );
  }
}
