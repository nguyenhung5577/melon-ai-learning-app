/**
 * POST /api/v1/rag/ingest
 * Proxy to melon-ai-backend /api/v1/ingest.
 */

import { NextRequest, NextResponse } from "next/server";
import { getMelonAiEndpoint } from "@/lib/server/melon-ai-backend";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const backendForm = new FormData();
  backendForm.append("file", file, file.name);

  try {
    const res = await fetch(getMelonAiEndpoint("/api/v1/ingest"), {
      method: "POST",
      body: backendForm,
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Cannot connect to melon-ai-backend ingest endpoint",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 }
    );
  }
}
