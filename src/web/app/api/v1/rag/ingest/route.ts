/**
 * POST /api/v1/rag/ingest — Upload a PDF, chunk it, embed with OpenAI,
 * and upsert vectors into Pinecone.
 *
 * Accepts multipart/form-data with:
 *   - file: PDF file
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
  const formData = await req.formData();
  const file     = formData.get("file") as File | null;
  const lessonId = (formData.get("lessonId") as string) ?? "unknown";
  const subject  = (formData.get("subject")  as string) ?? "general";

  if (!file) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const openai   = getOpenAI();
  const pinecone = getPinecone();
  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await pdfParse(buffer);
  const text   = parsed.text;

  if (!text.trim()) {
    return NextResponse.json({ error: "Could not extract text from PDF" }, { status: 422 });
  }

  const chunks = chunkText(text);

  // Embed all chunks
  const embedRes = await openai.embeddings.create({
    model:  "text-embedding-3-small",
    input:  chunks,
  });

  const vectors = embedRes.data.map((e, i) => ({
    id:       `${lessonId}-chunk-${i}`,
    values:   e.embedding,
    metadata: {
      lessonId,
      subject,
      chunkIndex: i,
      text:       chunks[i],
    },
  }));

  // Upsert into Pinecone
  const index = pinecone.index(process.env.PINECONE_INDEX ?? "melon-lessons");
  await index.namespace(process.env.PINECONE_NAMESPACE ?? "default").upsert({ records: vectors });

  return NextResponse.json({
    success:    true,
    lessonId,
    chunkCount: chunks.length,
    charCount:  text.length,
  });
}
