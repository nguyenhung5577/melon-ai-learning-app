import { type NextRequest, NextResponse } from "next/server"
import { runMultimodalEval, isEvalConfigured } from "@/lib/providers/multimodal-eval"

export async function POST(request: NextRequest) {
  try {
    if (!isEvalConfigured()) {
      return NextResponse.json(
        { error: "Eval provider key not configured" },
        { status: 500 }
      )
    }

    const body = (await request.json()) as {
      question: string
      expectedAnswer: string
      userTranscript: string
      drawingImageBase64?: string | null
      episodeTitle?: string
      sceneDialogue?: string
      sceneNumber?: number
    }

    const { question, expectedAnswer, userTranscript, drawingImageBase64, episodeTitle, sceneDialogue, sceneNumber } =
      body

    if (!question || !expectedAnswer) {
      return NextResponse.json({ error: "question and expectedAnswer required" }, { status: 400 })
    }

    const transcript = (userTranscript || "").trim()
    const drawingB64 = drawingImageBase64?.replace(/^data:image\/\w+;base64,/, "") || ""

    if (!transcript && !drawingB64) {
      return NextResponse.json({
        correct: false,
        feedback: "Draw your answer and speak into the microphone!",
      })
    }

    const result = await runMultimodalEval(
      {
        question,
        expected: expectedAnswer,
        transcript,
        episodeTitle,
        sceneDialogue,
        sceneNumber,
      },
      drawingB64 || undefined
    )

    return NextResponse.json(result)
  } catch (err) {
    console.error("Evaluate checkpoint error:", err)
    return NextResponse.json(
      { correct: false, feedback: "Something went wrong. Try again!" },
      { status: 500 }
    )
  }
}
