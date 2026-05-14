/**
 * POST /api/v1/rag/ingest
 * Proxy PDF ingestion to melon-ai-backend /api/v1/ingest.
 *
 * Accepts either:
 * - multipart/form-data with file
 * - JSON with pdfUrl, lessonId, subject
 */

import { NextRequest, NextResponse } from "next/server";
import { getMelonAiEndpoint } from "@/lib/server/melon-ai-backend";

async function buildBackendForm(req: NextRequest): Promise<FormData | NextResponse> {
  const contentType = req.headers.get("content-type") ?? "";
  const backendForm = new FormData();

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    backendForm.append("file", file, file.name);
    return backendForm;
  }

  const body = await req.json();
  const { pdfUrl, lessonId } = body;

  if (!pdfUrl) {
    return NextResponse.json({ error: "pdfUrl required" }, { status: 400 });
  }

  const pdfRes = await fetch(pdfUrl);
  if (!pdfRes.ok) {
    return NextResponse.json(
      { error: `Failed to fetch PDF from ${pdfUrl}` },
      { status: 400 }
    );
  }

  const blob = await pdfRes.blob();
  backendForm.append("file", blob, `${lessonId || "lesson"}.pdf`);
  return backendForm;
}

export async function POST(req: NextRequest) {
  try {
    const backendForm = await buildBackendForm(req);
    if (backendForm instanceof NextResponse) {
      return backendForm;
    }

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
