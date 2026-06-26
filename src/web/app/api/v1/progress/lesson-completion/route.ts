import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireChildAccess } from "@/lib/server/child-access";
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
  concepts: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  completedAt: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  const body = CompletionSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const access = await requireChildAccess(req, body.data.childUid, "write");
  if (!access.ok) return access.response;

  const record = await recordLessonCompletion(body.data);
  const summary = await getProgressSummary(body.data.childUid);

  return NextResponse.json({ record, summary }, { status: 201 });
}
