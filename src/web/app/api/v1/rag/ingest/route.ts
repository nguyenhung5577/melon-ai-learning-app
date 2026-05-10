/**
 * POST /api/v1/rag/ingest — Chunk a PDF, embed with OpenAI, and upsert vectors into Pinecone.
 *
 * Accepts JSON with:
 *   - pdfUrl: string (Public URL of the PDF)
 *   - lessonId: string (metadata tag)
 *   - subject: string (metadata tag)
 */

import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;

function getOpenAI()   { return new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); }
function getPinecone() { return new Pinecone({ apiKey: process.env.PINECONE_API_KEY! }); }

const CHUNK_SIZE   = 500;  // chars per chunk
const CHUNK_OVERLAP = 100;

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks.filter((c) => c.trim().length > 50);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pdfUrl, lessonId, subject } = body;

    if (!pdfUrl) {
      return NextResponse.json({ error: "pdfUrl required" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY || !process.env.PINECONE_API_KEY) {
      throw new Error("Missing AI API keys (OpenAI or Pinecone) in .env.local");
    }

    // 1. Download PDF from URL
    const pdfRes = await fetch(pdfUrl);
    if (!pdfRes.ok) throw new Error(`Failed to fetch PDF from ${pdfUrl}`);
    const buffer = Buffer.from(await pdfRes.arrayBuffer());

    // 2. Parse PDF
    const openai   = getOpenAI();
    const pinecone = getPinecone();
    const parsed = await pdfParse(buffer);
    const text   = parsed.text;

    if (!text.trim()) {
      return NextResponse.json({ error: "Could not extract text from PDF" }, { status: 422 });
    }

    const chunks = chunkText(text);

    // 3. Embed all chunks
    const embedRes = await openai.embeddings.create({
      model:  "text-embedding-3-small",
      input:  chunks,
    });

    const vectors = embedRes.data.map((e, i) => ({
      id:       `${lessonId}-chunk-${i}`,
      values:   e.embedding,
      metadata: {
        lessonId,
        subject: subject || "general",
        chunkIndex: i,
        text:       chunks[i],
      },
    }));

    // 4. Upsert into Pinecone
    const index = pinecone.index(process.env.PINECONE_INDEX ?? "melon-lessons");
    const namespace = index.namespace(process.env.PINECONE_NAMESPACE ?? "default");
    
    await namespace.upsert(vectors as any);

    return NextResponse.json({
      success: true,
      lessonId,
      chunks: chunks.length,
      chars:  text.length,
    });
  } catch (error: any) {
    console.error("Ingest error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
