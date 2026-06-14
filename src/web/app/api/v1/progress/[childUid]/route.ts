import { NextRequest, NextResponse } from "next/server";
import { getLessonCompletions, getPersonalizedPlan, getProgressSummary } from "@/lib/progress/progress-store";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ childUid: string }> }
) {
  const { childUid } = await params;
  const [summary, completions, plan] = await Promise.all([
    getProgressSummary(childUid),
    getLessonCompletions(childUid),
    getPersonalizedPlan(childUid),
  ]);

  return NextResponse.json({ summary, completions, plan });
}

