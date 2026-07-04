import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/server/firebase-admin";
import { writeExerciseAttemptInTransaction } from "@/lib/progress/progress-store";

export const runtime = "nodejs";

const SubmitAttemptSchema = z.object({
  questionId: z.string().min(1),
  submittedAnswer: z.string(),
  timeSpentMs: z.number().int().min(0).default(0),
  startedAt: z.string().datetime().optional(),
  source: z.enum(["practice", "student_submission", "question_bank"]).default("practice"),
  courseId: z.string().min(1).optional(),
  courseRunId: z.string().min(1).optional(),
  pipelineId: z.string().min(1).optional(),
  stageId: z.string().min(1).optional(),
  stageTitle: z.string().min(1).optional(),
});

const mojibakeWindows1252Bytes: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  "ƒ": 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  "ˆ": 0x88,
  "‰": 0x89,
  "Š": 0x8a,
  "‹": 0x8b,
  "Œ": 0x8c,
  "Ž": 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  "š": 0x9a,
  "›": 0x9b,
  "œ": 0x9c,
  "ž": 0x9e,
  "Ÿ": 0x9f,
};

function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

function mojibakeScore(value: string) {
  const suspicious = value.match(/[ÃÂÄÅÆÐðÑÒÓÔÕÙÝÞáºá»à¸à¹]/g)?.length ?? 0;
  const replacement = value.match(/\uFFFD/g)?.length ?? 0;
  const vietnamese = value.match(/[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/giu)?.length ?? 0;
  return suspicious * 3 + replacement * 6 - vietnamese;
}

function encodeWindows1252Mojibake(value: string): Uint8Array | null {
  const bytes: number[] = [];
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0xff) {
      bytes.push(code);
      continue;
    }

    const mapped = mojibakeWindows1252Bytes[char];
    if (mapped === undefined) return null;
    bytes.push(mapped);
  }
  return new Uint8Array(bytes);
}

function repairMojibake(value: unknown) {
  const text = String(value ?? "");
  if (!/[ÃÂÄÅÆÐðÑÒÓÔÕÙÝÞáºá»à¸à¹]/.test(text)) return text;

  const encoded = encodeWindows1252Mojibake(text);
  if (!encoded) return text;

  try {
    const repaired = new TextDecoder("utf-8", { fatal: true }).decode(encoded);
    return mojibakeScore(repaired) < mojibakeScore(text) ? repaired : text;
  } catch {
    return text;
  }
}

function normalizeAnswer(value: unknown): string {
  return repairMojibake(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/(?<=\d)\s(?=\d{3}\b)/g, "")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/^(-?\d+)\s+(-?\d+)$/g, "$1/$2")
    .replace(/[.,;:]$/g, "");
}

function normalizePartLabel(value: unknown, index = 0): string {
  const fallback = String.fromCharCode(97 + index);
  const text = repairMojibake(value).trim().toLowerCase();
  return text.match(/([a-z])\s*$/i)?.[1]?.toLowerCase() ?? fallback;
}

function choiceDisplayKey(choice: Record<string, unknown>, index: number): string {
  return repairMojibake(choice.key).trim() || ["A", "B", "C", "D"][index] || String(index + 1);
}

function isExpectedChoice(question: Record<string, unknown>, choice: Record<string, unknown>, index: number): boolean {
  const expectedAnswer = normalizeAnswer(question.answer);
  const expectedText = normalizeAnswer(question.answerText);
  const expectedMarkdown = normalizeAnswer(question.answerTextMarkdown);
  const choiceKey = normalizeAnswer(choiceDisplayKey(choice, index));
  const choiceText = normalizeAnswer(choice.text);

  return Boolean(
    (expectedAnswer && (choiceKey === expectedAnswer || choiceText === expectedAnswer)) ||
      (expectedText && (choiceKey === expectedText || choiceText === expectedText)) ||
      (expectedMarkdown && (choiceKey === expectedMarkdown || choiceText === expectedMarkdown))
  );
}

function labeledParts(value: unknown): Record<string, string> | null {
  const text = repairMojibake(value).trim();
  const matches = Array.from(text.matchAll(/([a-z])\s*[\).:]\s*/giu))
    .filter((match) => match.index !== undefined);
  if (matches.length < 2) return null;

  const parts: Record<string, string> = {};
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const label = match[1].toLowerCase();
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    const answer = normalizeAnswer(text.slice(start, end).replace(/^[\s;,-]+|[\s;,-]+$/g, ""));
    if (answer) parts[label] = answer;
  }

  return Object.keys(parts).length >= 2 ? parts : null;
}

function subQuestionAnswerParts(question: Record<string, unknown>): Record<string, string> | null {
  if (!Array.isArray(question.subQuestions)) return null;

  const parts: Record<string, string> = {};
  question.subQuestions.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const subQuestion = item as { label?: unknown; answerText?: unknown; answerTextMarkdown?: unknown };
    const answer = repairMojibake(subQuestion.answerTextMarkdown || subQuestion.answerText).trim();
    if (!answer) return;
    parts[normalizePartLabel(subQuestion.label, index)] = answer;
  });

  return Object.keys(parts).length > 0 ? parts : null;
}

function answersEquivalent(submittedAnswer: string, expectedAnswer: unknown): boolean {
  const submitted = normalizeAnswer(submittedAnswer);
  const expected = normalizeAnswer(expectedAnswer);
  if (!submitted || !expected) return false;
  if (submitted === expected) return true;

  const submittedParts = labeledParts(submittedAnswer);
  const expectedParts = labeledParts(expectedAnswer);
  if (!submittedParts || !expectedParts) return false;

  return Object.entries(expectedParts).every(([label, expectedPart]) => (
    submittedParts[label] === expectedPart
  ));
}

function subQuestionAnswersCorrect(question: Record<string, unknown>, submittedAnswer: string): boolean {
  const expectedParts = subQuestionAnswerParts(question);
  if (!expectedParts) return false;

  const submittedParts = labeledParts(submittedAnswer);
  if (!submittedParts) {
    const expectedValues = Object.values(expectedParts);
    return expectedValues.length === 1 && answersEquivalent(submittedAnswer, expectedValues[0]);
  }

  return Object.entries(expectedParts).every(([label, expectedAnswer]) => (
    answersEquivalent(submittedParts[label] ?? "", expectedAnswer)
  ));
}

function finalAnswerFromExplanation(value: unknown): string {
  const explanation = repairMojibake(value);
  const candidates: string[] = [];
  const finalPhrasePattern = /(?:tức là|vậy|đáp số|đáp án|trả lời|kết quả)[^0-9-]*(-?\d+(?:\s*\/\s*\d+)?)/giu;
  const variablePattern = /(?:^|[^\p{L}\p{N}])x\s*=\s*(-?\d+(?:\s*\/\s*\d+)?)/giu;

  for (const match of explanation.matchAll(finalPhrasePattern)) {
    candidates.push(match[1]);
  }
  for (const match of explanation.matchAll(variablePattern)) {
    candidates.push(match[1]);
  }

  return normalizeAnswer(candidates.at(-1));
}

function isAnswerCorrect(question: Record<string, unknown>, submittedAnswer: string): boolean {
  const submitted = normalizeAnswer(submittedAnswer);
  const answerText = question.answerText;
  const answerTextMarkdown = question.answerTextMarkdown;
  const explanationAnswer = finalAnswerFromExplanation(question.explanation);

  if (!submitted) return false;
  if (subQuestionAnswersCorrect(question, submittedAnswer)) return true;
  if (answersEquivalent(submittedAnswer, question.answer)) return true;
  if (answersEquivalent(submittedAnswer, question.answerText)) return true;
  if (answersEquivalent(submittedAnswer, question.answerTextMarkdown)) return true;
  if (explanationAnswer && submitted === explanationAnswer) return true;

  const choices = Array.isArray(question.choices) ? question.choices : [];
  return choices.some((choice, index) => {
    if (!choice || typeof choice !== "object") return false;
    const typedChoice = choice as Record<string, unknown>;
    const selected =
      normalizeAnswer(choiceDisplayKey(typedChoice, index)) === submitted ||
      normalizeAnswer(typedChoice.text) === submitted;
    if (!selected) return false;

    return (
      isExpectedChoice(question, typedChoice, index) ||
      Boolean(answerText && answersEquivalent(String(typedChoice.text ?? ""), answerText)) ||
      Boolean(answerTextMarkdown && answersEquivalent(String(typedChoice.text ?? ""), answerTextMarkdown))
    );
  });
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => repairMojibake(item).trim()).filter(Boolean);
}

export async function POST(req: NextRequest) {
  const body = SubmitAttemptSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
  }

  try {
    const auth = adminAuth();
    const db = adminDb();
    const decoded = await auth.verifyIdToken(token);
    const kidUid = decoded.uid;
    const userSnap = await db.collection("users").doc(kidUid).get();
    if (!userSnap.exists || userSnap.data()?.role !== "kid") {
      return NextResponse.json({ error: "Only kid accounts can submit answers." }, { status: 403 });
    }

    const questionSnap = await db.collection("questionBank").doc(body.data.questionId).get();
    let question = questionSnap.data() ?? {};
    if (!questionSnap.exists) {
      // Also check AI-generated questions
      const genSnap = await db.collection("generatedQuestions").doc(body.data.questionId).get();
      if (genSnap.exists) {
        question = genSnap.data() ?? {};
      } else {
        return NextResponse.json({ error: "Question not found." }, { status: 404 });
      }
    }
    const now = new Date().toISOString();
    const kidQuestionKey = `${kidUid}_${body.data.questionId}`;
    const attemptId = `${kidQuestionKey}_${Date.now()}`;
    const isCorrect = isAnswerCorrect(question, body.data.submittedAnswer);

    await db.runTransaction(async (tx) => {
      const statsRef = db.collection("kidQuestionStats").doc(kidQuestionKey);
      const statsSnap = await tx.get(statsRef);
      const stats = statsSnap.data() ?? {};
      const attemptCount = Number(stats.attemptCount ?? 0) + 1;
      const correctCount = Number(stats.correctCount ?? 0) + (isCorrect ? 1 : 0);
      const wrongCount = Number(stats.wrongCount ?? 0) + (isCorrect ? 0 : 1);

      await writeExerciseAttemptInTransaction(tx, db, {
        childUid: kidUid,
        questionId: body.data.questionId,
        questionSetId: repairMojibake(question.questionSetId ?? question.sourceSetId),
        sourceTitle: repairMojibake(question.sourceTitle),
        subject: repairMojibake(question.subject || "math"),
        grade: Number(question.grade ?? 0) || undefined,
        rubricLevel: repairMojibake(question.rubricLevel || "unclassified"),
        submittedAnswer: body.data.submittedAnswer,
        isCorrect,
        timeSpentMs: body.data.timeSpentMs,
        startedAt: body.data.startedAt ?? now,
        submittedAt: now,
        source: body.data.source,
        concepts: stringList(question.concepts),
        skills: stringList(question.skills),
        courseId: body.data.courseId,
        courseRunId: body.data.courseRunId,
        pipelineId: body.data.pipelineId,
        stageId: body.data.stageId,
        stageTitle: body.data.stageTitle,
      }, attemptId);

      tx.set(db.collection("questionAttempts").doc(attemptId), {
        id: attemptId,
        kidUid,
        questionId: body.data.questionId,
        kidQuestionKey,
        submittedAnswer: body.data.submittedAnswer,
        isCorrect,
        timeSpentMs: body.data.timeSpentMs,
        startedAt: body.data.startedAt ?? now,
        submittedAt: now,
        source: body.data.source,
      });

      tx.set(statsRef, {
        id: kidQuestionKey,
        kidUid,
        questionId: body.data.questionId,
        kidQuestionKey,
        attemptCount,
        correctCount,
        wrongCount,
        lastIsCorrect: isCorrect,
        lastSubmittedAt: now,
        lastTimeSpentMs: body.data.timeSpentMs,
      }, { merge: true });
    });

    let courseRun: { id: string; status?: unknown; currentStageId?: unknown; currentStageOrder?: unknown } | undefined;
    if (body.data.courseRunId) {
      const runSnap = await db.collection("studentCourseRuns").doc(body.data.courseRunId).get();
      if (runSnap.exists) {
        const run = runSnap.data() ?? {};
        courseRun = {
          id: runSnap.id,
          status: run.status,
          currentStageId: run.currentStageId,
          currentStageOrder: run.currentStageOrder,
        };
      }
    }

    return NextResponse.json({ attemptId, kidQuestionKey, isCorrect, courseRun });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không lưu được kết quả làm bài." },
      { status: 500 }
    );
  }
}
