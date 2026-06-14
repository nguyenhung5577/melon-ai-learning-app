import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMelonAiBackendUrl, getMelonAiEndpoint } from "@/lib/server/melon-ai-backend";

const RequestSchema = z.object({
  question: z.string().min(1),
  studentAnswer: z.string().optional(),
  correctAnswer: z.string().optional(),
  fileId: z.string().optional(),
  topic: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = RequestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  try {
    const res = await fetch(getMelonAiEndpoint("/api/v1/exercise/guide"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: body.data.question,
        student_answer: body.data.studentAnswer,
        correct_answer: body.data.correctAnswer,
        file_id: body.data.fileId,
        topic: body.data.topic,
      }),
      cache: "no-store",
    });

    const data = (await res.json()) as {
      guidance?: string;
      audio_url?: string;
      error?: string;
    };

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    const audioUrl = data.audio_url?.startsWith("http")
      ? data.audio_url
      : `${getMelonAiBackendUrl()}${data.audio_url ?? ""}`;

    return NextResponse.json({
      guidance: data.guidance ?? "",
      audioUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Cannot connect to melon-ai-backend exercise guide endpoint",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 }
    );
  }
}
