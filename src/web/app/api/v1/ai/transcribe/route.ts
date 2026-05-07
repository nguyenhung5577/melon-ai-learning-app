import { NextResponse } from "next/server"
import { runSpeechToText, isTranscriptConfigured } from "@/lib/providers/speech-to-text"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const audioFile = (formData.get("audio") ?? formData.get("video") ?? formData.get("file")) as File | null

    if (!audioFile || !(audioFile instanceof File)) {
      return NextResponse.json(
        { error: "No audio or video file provided. Send a file under 'audio', 'video', or 'file'." },
        { status: 400 }
      )
    }

    if (!isTranscriptConfigured()) {
      return NextResponse.json(
        { error: "Transcript provider key not configured" },
        { status: 500 }
      )
    }

    const blob = new Blob([await audioFile.arrayBuffer()], { type: audioFile.type || "audio/webm" })
    const result = await runSpeechToText({
      audio: blob,
      mime: audioFile.type || "audio/webm",
      language: "en",
    })

    return NextResponse.json({ text: result.text })
  } catch (err) {
    console.error("Transcribe route error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
