import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMelonAiBackendUrl, getMelonAiEndpoint } from "@/lib/server/melon-ai-backend";
import { adminAuth, adminDb } from "@/lib/server/firebase-admin";
import { getUserSubscription, getEntitlements } from "@/lib/subscription/subscription-service";

const RequestSchema = z.object({
  question: z.string().min(1),
  studentAnswer: z.string().optional(),
  correctAnswer: z.string().optional(),
  fileId: z.string().optional(),
  topic: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing Auth Header" }, { status: 401 });
  }

  try {
    const token = authHeader.split("Bearer ")[1];
    const decoded = await adminAuth().verifyIdToken(token);
    const uid = decoded.uid;

    let parentUid = uid;
    const childDoc = await adminDb().collection("children").doc(uid).get();
    if (childDoc.exists) {
      parentUid = childDoc.data()?.linkedParentUid;
    }

    const subscription = await getUserSubscription(parentUid);
    const entitlements = getEntitlements(subscription);

    if (!entitlements.aiCoaching) {
      return NextResponse.json(
        { error: "Tính năng AI yêu cầu gói Pro. Vui lòng nhờ Phụ huynh nâng cấp!" },
        { status: 403 }
      );
    }
  } catch (error: any) {
    console.error("Auth Error in AI Hint API:", error);
    return NextResponse.json({ error: "Lỗi hệ thống xác thực. Vui lòng thử lại." }, { status: 401 });
  }

  const body = RequestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  try {
    const res = await fetch(getMelonAiEndpoint("/api/v1/exercise/guide"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: body.data.question,
        student_answer: body.data.studentAnswer,
        correct_answer: body.data.correctAnswer,
        file_id: body.data.fileId,
        topic: body.data.topic,
      }),
      cache: "no-store",
    });

    const data = (await res.json()) as {
      guidance?: string;
      audio_url?: string;
      error?: string;
    };

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    const audioUrl = data.audio_url?.startsWith("http")
      ? data.audio_url
      : `${getMelonAiBackendUrl()}${data.audio_url ?? ""}`;

    return NextResponse.json({
      guidance: data.guidance ?? "",
      audioUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Cannot connect to melon-ai-backend exercise guide endpoint",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 }
    );
  }
}
