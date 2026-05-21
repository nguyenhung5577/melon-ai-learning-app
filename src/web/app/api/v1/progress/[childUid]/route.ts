import { NextRequest, NextResponse } from "next/server";
import { getLessonCompletions, getProgressSummary } from "@/lib/progress/progress-store";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ childUid: string }> }
) {
  const { childUid } = await params;
  const summary = await getProgressSummary(childUid);
  const completions = await getLessonCompletions(childUid);

  return NextResponse.json({ summary, completions });
}

