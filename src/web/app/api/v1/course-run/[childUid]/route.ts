import { NextRequest, NextResponse } from "next/server";
import { getCourseRunSnapshots } from "@/lib/progress/course-run-store";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ childUid: string }> }
) {
  const { childUid } = await params;
  const includeCompleted = req.nextUrl.searchParams.get("status") === "all";
  const runs = await getCourseRunSnapshots(childUid, { includeCompleted });
  return NextResponse.json({ runs });
}
