import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProgressSummary, recordLessonCompletion } from "@/lib/progress/progress-store";

export const runtime = "nodejs";

const CompletionSchema = z.object({
  childUid: z.string().min(1),
  lessonId: z.string().min(1),
  lessonTitle: z.string().min(1),
  subject: z.string().min(1),
  scorePercent: z.number().min(0).max(100),
  quizCorrect: z.number().int().min(0),
  quizTotal: z.number().int().min(0),
  xpEarned: z.number().int().min(0),
  timeOnTaskSeconds: z.number().int().min(0),
  completedAt: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  const body = CompletionSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const record = await recordLessonCompletion(body.data);
  const summary = await getProgressSummary(body.data.childUid);

  return NextResponse.json({ record, summary }, { status: 201 });
}

