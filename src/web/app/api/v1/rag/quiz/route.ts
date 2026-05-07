/**
 * POST /api/v1/rag/quiz — Generate quiz questions from lesson content via RAG.
 *
 * Body: { lessonId: string, count?: number, difficulty?: "easy"|"medium"|"hard" }
 *
 * Flow:
 *  1. Embed a retrieval query ("generate quiz questions about {lessonId}")
 *  2. Query Pinecone for top-k relevant chunks
 *  3. Send context + GPT prompt → JSON quiz questions
 */

import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";
import { z } from "zod";

function getOpenAI()   { return new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); }
function getPinecone() { return new Pinecone({ apiKey: process.env.PINECONE_API_KEY! }); }

const BodySchema = z.object({
  lessonId:   z.string(),
  count:      z.number().int().min(1).max(10).default(5),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
});

const QuizSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      options:  z.array(z.string()).length(4),
      answer:   z.string(),
      xp:       z.number(),
    })
  ),
});

export async function POST(req: NextRequest) {
  const body = BodySchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const { lessonId, count, difficulty } = body.data;

  const openai   = getOpenAI();
  const pinecone = getPinecone();

  // Embed retrieval query
  const queryEmbed = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: `quiz questions for lesson: ${lessonId}`,
  });

  const index = pinecone.index(process.env.PINECONE_INDEX ?? "melon-lessons");
  const results = await index
    .namespace(process.env.PINECONE_NAMESPACE ?? "default")
    .query({
      vector:          (queryEmbed.data[0] as { embedding: number[] }).embedding,
      topK:            8,
      includeMetadata: true,
      filter:          { lessonId: { $eq: lessonId } },
    });

  const context = results.matches
    .map((m) => (m.metadata?.text as string) ?? "")
    .join("\n\n");

  if (!context.trim()) {
    return NextResponse.json(
      { error: `No content found for lessonId: ${lessonId}` },
      { status: 404 }
    );
  }

  const xpMap = { easy: 20, medium: 35, hard: 50 };
  const prompt = `You are creating a quiz for children aged 6-14. Generate ${count} ${difficulty} multiple-choice questions based on the following lesson content.

LESSON CONTENT:
${context}

REQUIREMENTS:
- Each question must have exactly 4 options (A, B, C, D)
- One clearly correct answer
- Age-appropriate language
- Varied question types (what, why, how, which)

Respond ONLY with valid JSON matching this exact schema:
{
  "questions": [
    {
      "question": "...",
      "options": ["option A", "option B", "option C", "option D"],
      "answer": "option A",
      "xp": ${xpMap[difficulty]}
    }
  ]
}`;

  const completion = await openai.chat.completions.create({
    model:       process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages:    [{ role: "user", content: prompt }],
    temperature: 0.6,
    response_format: { type: "json_object" },
  });

  const raw     = completion.choices[0]?.message?.content ?? "{}";
  const parsed  = QuizSchema.safeParse(JSON.parse(raw));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid quiz format from AI" }, { status: 502 });
  }

  return NextResponse.json({
    lessonId,
    difficulty,
    questions: parsed.data.questions,
  });
}
