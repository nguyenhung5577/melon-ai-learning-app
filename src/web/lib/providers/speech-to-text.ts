/**
 * Speech-to-text pipeline: accepts audio blob and returns transcript.
 * Endpoint and key are read from env; no provider-specific symbols.
 */

import type { SpeechToTextInput, SpeechToTextResult } from "./types"

const BASE_URL = process.env.OPENAI_API_BASE ?? "https://api.openai.com"
const AUTH_KEY = process.env.OPENAI_API_KEY ?? ""

function resolveSttEndpoint(): string {
  if (!BASE_URL) return ""
  return `${BASE_URL.replace(/\/$/, "")}/v1/audio/transcriptions`
}

const SUPPORTED_EXT = ["mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"]

function safeFilename(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase()
  if (ext && SUPPORTED_EXT.includes(ext)) return name
  return `${name}.webm`
}

export async function runSpeechToText(input: SpeechToTextInput): Promise<SpeechToTextResult> {
  if (!AUTH_KEY) throw new Error("Transcript provider key not configured")
  const url = resolveSttEndpoint()
  if (!url) throw new Error("Transcript API URL not configured")
  const form = new FormData()
  form.append("file", input.audio, safeFilename("recording.webm"))
  form.append("model", "whisper-1")
  form.append("language", input.language)

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${AUTH_KEY}` },
    body: form,
  })
  if (!res.ok) {
    const t = await res.text()
    console.error("STT pipeline error:", t)
    throw new Error("Transcription failed")
  }
  const data = await res.json()
  return { text: data.text ?? "" }
}

export function isTranscriptConfigured(): boolean {
  return Boolean(AUTH_KEY)
}
