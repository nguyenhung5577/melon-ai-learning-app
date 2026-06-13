import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMelonAiEndpoint } from "@/lib/server/melon-ai-backend";

const RequestSchema = z.object({
  topic: z.string().min(1),
  fileId: z.string().min(1),
  count: z.number().int().min(1).max(10).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
});

function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

export async function POST(req: NextRequest) {
  const body = RequestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
  }

  // --- FREEMIUM GUARD ---
  const { requireEntitlement } = await import("@/lib/server/subscription-guard");
  const guard = await requireEntitlement(token, "canGenerateExercises");
  if (!guard.allowed) {
    return NextResponse.json({ 
      error: guard.error, 
      message: "Vui lòng nâng cấp lên Melon Pro để sử dụng tính năng Sinh bài tập bằng AI.",
      requiredPlan: guard.requiredPlan 
    }, { status: 402 });
  }
  // ----------------------

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
