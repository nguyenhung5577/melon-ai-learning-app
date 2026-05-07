/**
 * POST /api/v1/ai/chat — SSE streaming chat with Cosmo AI tutor.
 * Streams GPT-4o-mini tokens as Server-Sent Events.
 * Includes content moderation via OpenAI Moderation API.
 */

import OpenAI from "openai";
import { NextRequest } from "next/server";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const COSMO_SYSTEM = `You are Cosmo, a friendly and encouraging AI tutor for children aged 6-14.
You help kids understand school lessons in a fun, simple way.
Always:
- Use simple, age-appropriate language
- Be encouraging and positive
- Give concrete examples kids can relate to
- Keep responses concise (2-4 sentences unless more depth is requested)
- Never discuss topics unrelated to learning or school
- If asked about inappropriate topics, gently redirect to learning`;

export async function POST(req: NextRequest) {
  const { message, lessonContext, kidName } = await req.json();

  if (!message?.trim()) {
    return new Response("Message required", { status: 400 });
  }

  const openai = getOpenAI();
  // Moderation check
  const mod = await openai.moderations.create({ input: message });
  if (mod.results[0]?.flagged) {
    return new Response(
      JSON.stringify({ error: "Message flagged by content moderation" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const systemPrompt = lessonContext
    ? `${COSMO_SYSTEM}\n\nCurrent lesson context: ${lessonContext}`
    : COSMO_SYSTEM;

  const userMessage = kidName
    ? `${kidName} asks: ${message}`
    : message;

  // Stream response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const completion = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          stream: true,
          max_tokens: 300,
          temperature: 0.7,
        });

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta })}\n\n`));
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  });
}
