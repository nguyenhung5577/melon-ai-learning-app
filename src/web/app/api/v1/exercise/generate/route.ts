import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMelonAiEndpoint } from "@/lib/server/melon-ai-backend";

const RequestSchema = z.object({
  topic: z.string().min(1),
  fileId: z.string().min(1),
  count: z.number().int().min(1).max(10).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
});

export async function POST(req: NextRequest) {
  const body = RequestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  try {
    const res = await fetch(getMelonAiEndpoint("/api/v1/exercise/generate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: body.data.topic,
        file_id: body.data.fileId,
        count: body.data.count ?? 5,
        difficulty: body.data.difficulty ?? "medium",
      }),
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Cannot connect to melon-ai-backend exercise generation endpoint",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 }
    );
  }
}
