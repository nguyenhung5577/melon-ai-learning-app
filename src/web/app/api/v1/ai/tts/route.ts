/**
 * POST /api/v1/ai/tts
 * Proxy text-to-speech requests to melon-ai-backend /api/v1/tts.
 */

import { NextRequest, NextResponse } from "next/server";
import { getMelonAiBackendUrl, getMelonAiEndpoint } from "@/lib/server/melon-ai-backend";

function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

export async function POST(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
  }

  // --- FREEMIUM GUARD ---
  const { requireEntitlement } = await import("@/lib/server/subscription-guard");
  const guard = await requireEntitlement(token, "aiCoaching");
  if (!guard.allowed) {
    return NextResponse.json({ 
      error: guard.error, 
      message: "Tính năng đọc giọng nói AI yêu cầu gói Pro. Vui lòng nâng cấp!",
      requiredPlan: guard.requiredPlan 
    }, { status: 402 });
  }
  // ----------------------

  const { text } = await req.json();

  if (!text?.trim()) {
    return NextResponse.json({ error: "Text required" }, { status: 400 });
  }

  if (text.length > 1000) {
    return NextResponse.json(
      { error: "Text too long (max 1000 chars)" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(getMelonAiEndpoint("/api/v1/tts"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      cache: "no-store",
    });

    const data = (await res.json()) as { audio_url?: string; error?: string };
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    // Backend usually returns relative path; convert to absolute URL for frontend audio player.
    const audioUrl = data.audio_url?.startsWith("http")
      ? data.audio_url
      : `${getMelonAiBackendUrl()}${data.audio_url ?? ""}`;

    return NextResponse.json({ audioUrl });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Cannot connect to melon-ai-backend tts endpoint",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 }
    );
  }
}
