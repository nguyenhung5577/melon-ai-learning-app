/**
 * POST /api/v1/rag/quiz
 * Proxy quiz generation to melon-ai-backend /api/v1/generate.
 *
 * Accepted body:
 * - { topic: string, fileId?: string }
 * - Backward compatible: { lessonId: string } (mapped to topic)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMelonAiEndpoint } from "@/lib/server/melon-ai-backend";

const RequestSchema = z.object({
  topic: z.string().optional(),
  fileId: z.string().optional(),
  lessonId: z.string().optional(),
});

type BackendQuestion = {
  question: string;
  choices?: Record<string, string>;
  options?: string[];
  answer?: string;
  image_url?: string;
};

function normalizeOptions(question: BackendQuestion): string[] {
  if (Array.isArray(question.options) && question.options.length > 0) {
    return question.options;
  }
  if (question.choices) {
    return Object.values(question.choices);
  }
  return [];
}

function normalizeAnswer(question: BackendQuestion, options: string[]): string {
  if (!question.answer) return "";
  if (question.choices && question.choices[question.answer]) {
    return question.choices[question.answer];
  }
  if (options.includes(question.answer)) {
    return question.answer;
  }
  return "";
}

export async function POST(req: NextRequest) {
  const body = RequestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const topic = body.data.topic?.trim() || body.data.lessonId?.trim();
  if (!topic) {
    return NextResponse.json(
      { error: "topic (or lessonId) is required" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(getMelonAiEndpoint("/api/v1/generate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        file_id: body.data.fileId,
      }),
      cache: "no-store",
    });

    const data = (await res.json()) as {
      topic?: string;
      questions?: BackendQuestion[];
      error?: string;
    };

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    const questions = (data.questions ?? []).map((question) => {
      const options = normalizeOptions(question);
      return {
        question: question.question,
        options,
        answer: normalizeAnswer(question, options),
        xp: 35,
        image_url: question.image_url,
      };
    });

    return NextResponse.json({
      topic: data.topic ?? topic,
      questions,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Cannot connect to melon-ai-backend generate endpoint",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 }
    );
  }
}
