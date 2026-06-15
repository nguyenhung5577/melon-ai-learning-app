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

function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

function normalizeAnswer(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/^(-?\d+)\s+(-?\d+)$/g, "$1/$2")
    .replace(/[.,;:]$/g, "");
}

function labeledParts(value: unknown): Record<string, string> | null {
  const text = String(value ?? "").trim();
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

function finalAnswerFromExplanation(value: unknown): string {
  const explanation = String(value ?? "");
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
  const explanationAnswer = finalAnswerFromExplanation(question.explanation);

  if (!submitted) return false;
  if (answersEquivalent(submittedAnswer, question.answer)) return true;
  if (answersEquivalent(submittedAnswer, question.answerText)) return true;
  if (explanationAnswer && submitted === explanationAnswer) return true;

  const choices = Array.isArray(question.choices) ? question.choices : [];
  const selectedChoice = choices.find((choice) => {
    if (!choice || typeof choice !== "object") return false;
    return normalizeAnswer((choice as { key?: unknown }).key) === submitted;
  });
  return Boolean(
    selectedChoice &&
      answerText &&
      answersEquivalent(String((selectedChoice as { text?: unknown }).text ?? ""), answerText)
  );
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
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
        questionSetId: String(question.questionSetId ?? question.sourceSetId ?? ""),
        sourceTitle: String(question.sourceTitle ?? ""),
        subject: String(question.subject ?? "math"),
        grade: Number(question.grade ?? 0) || undefined,
        rubricLevel: String(question.rubricLevel ?? "unclassified"),
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

    return NextResponse.json({ attemptId, kidQuestionKey, isCorrect });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không lưu được kết quả làm bài." },
      { status: 500 }
    );
  }
}
