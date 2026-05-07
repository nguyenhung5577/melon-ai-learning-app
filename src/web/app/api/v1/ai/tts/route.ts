/**
 * POST /api/v1/ai/tts — Text-to-Speech via ElevenLabs.
 * Caches audio in-memory (Map) by text hash.
 * Falls back to browser TTS instruction on ElevenLabs error.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const TTS_CACHE = new Map<string, ArrayBuffer>();

function hashText(text: string): string {
  return crypto.createHash("md5").update(text).digest("hex");
}

export async function POST(req: NextRequest) {
  const { text, voiceId } = await req.json();

  if (!text?.trim()) {
    return NextResponse.json({ error: "Text required" }, { status: 400 });
  }

  if (text.length > 1000) {
    return NextResponse.json({ error: "Text too long (max 1000 chars)" }, { status: 400 });
  }

  const hash = hashText(text);

  // Cache hit
  const cached = TTS_CACHE.get(hash);
  if (cached) {
    return new Response(cached, {
      headers: { "Content-Type": "audio/mpeg", "X-Cache": "HIT" },
    });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voice  = voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";

  if (!apiKey) {
    return NextResponse.json(
      { error: "ElevenLabs not configured", fallback: true },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
      {
        method: "POST",
        headers: {
          "xi-api-key":   apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_monolingual_v1",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
    }

    const buffer = await res.arrayBuffer();
    TTS_CACHE.set(hash, buffer);

    return new Response(buffer, {
      headers: { "Content-Type": "audio/mpeg", "X-Cache": "MISS" },
    });
  } catch (err) {
    console.error("TTS error:", err);
    return NextResponse.json(
      { error: "TTS failed", fallback: true },
      { status: 502 }
    );
  }
}
