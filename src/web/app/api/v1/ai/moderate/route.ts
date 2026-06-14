/**
 * POST /api/v1/ai/moderate — OpenAI Moderation API.
 * Returns flagged status and categories.
 */

import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

function getOpenAI() { return new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); }

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  if (!text?.trim()) {
    return NextResponse.json({ error: "Text required" }, { status: 400 });
  }

  const openai = getOpenAI();
  const result = await openai.moderations.create({ input: text });
  const r = result.results[0];

  return NextResponse.json({
    flagged: r.flagged,
    categories: Object.entries(r.categories)
      .filter(([, v]) => v)
      .map(([k]) => k),
    scores: r.category_scores,
  });
}
