import { NextRequest } from "next/server";
import { adminDb } from "@/lib/server/firebase-admin";
import { classifyBatch } from "@/lib/problems/rubric-classifier";
import type { ClassifyProgress } from "@/lib/problems/rubric-classifier";

/**
 * POST /api/v1/problems/classify-rubric
 *
 * Body options:
 *   { all: true }               — classify all unclassified questions
 *   { questionIds: string[] }   — classify specific questions
 *
 * Response: Server-Sent Events stream with progress updates.
 */

interface RequestBody {
  all?: boolean;
  questionIds?: string[];
}

function sseEvent(data: ClassifyProgress): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;
    const db = adminDb();
    const questionBankRef = db.collection("questionBank");

    // 1. Fetch questions to classify
    let snapshot;
    if (body.questionIds && body.questionIds.length > 0) {
      // Firestore `in` queries support max 30 items, chunk them
      const ids = body.questionIds.slice(0, 500);
      const chunks: FirebaseFirestore.QueryDocumentSnapshot[] = [];
      for (let i = 0; i < ids.length; i += 30) {
        const chunk = ids.slice(i, i + 30);
        const snap = await questionBankRef
          .where("__name__", "in", chunk.map((id) => questionBankRef.doc(id)))
          .get();
        chunks.push(...snap.docs);
      }
      snapshot = chunks;
    } else if (body.all) {
      const snap = await questionBankRef
        .where("rubricLevel", "==", "unclassified")
        .get();
      snapshot = snap.docs;
    } else {
      return new Response(
        JSON.stringify({ error: "Cần truyền { all: true } hoặc { questionIds: [...] }" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (snapshot.length === 0) {
      return new Response(
        JSON.stringify({ message: "Không có câu hỏi cần phân loại", classified: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // 2. Prepare questions
    const questions = snapshot.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id ?? (data.id as string),
        rawText: (data.rawText as string) ?? "",
        stem: (data.stem as string) ?? "",
        grade: (data.grade as number) ?? 5,
        section: (data.section as string) ?? "",
        type: (data.type as string) ?? "essay",
      };
    });

    // 3. Stream classification results via SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const progress of classifyBatch(questions)) {
            // Write to Firestore on each successful classification
            if (progress.type === "progress" && progress.current) {
              const result = progress.current;
              const now = new Date().toISOString();
              try {
                await questionBankRef.doc(result.questionId).update({
                  rubricLevel: result.rubricLevel,
                  classifiedAt: now,
                  updatedAt: now,
                  updatedBy: "ai-rubric-classifier",
                  aiClassification: {
                    confidence: result.confidence,
                    reasoning: result.reasoning,
                    classifiedAt: now,
                    model: "gemini-2.0-flash",
                  },
                });
              } catch (dbError) {
                progress.error = `DB update failed for ${result.questionId}: ${dbError instanceof Error ? dbError.message : String(dbError)}`;
              }
            }

            controller.enqueue(encoder.encode(sseEvent(progress)));
          }
        } catch (err) {
          const errorEvent: ClassifyProgress = {
            type: "error",
            classified: 0,
            total: questions.length,
            error: err instanceof Error ? err.message : String(err),
          };
          controller.enqueue(encoder.encode(sseEvent(errorEvent)));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Lỗi server khi phân loại rubric",
        detail: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
