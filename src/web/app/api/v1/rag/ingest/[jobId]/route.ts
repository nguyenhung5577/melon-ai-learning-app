import { NextRequest, NextResponse } from "next/server";
import { getMelonAiEndpoint } from "@/lib/server/melon-ai-backend";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  try {
    const res = await fetch(getMelonAiEndpoint(`/api/v1/ingest/${jobId}`), {
      method: "GET",
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Cannot connect to melon-ai-backend ingest status endpoint",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 }
    );
  }
}
