/**
 * Multimodal reasoning pipeline: fuses text and image inputs and returns
 * a structured evaluation result. Provider key is read from env only.
 */

import { GoogleGenAI, createPartFromBase64, createPartFromText } from "@google/genai"
import type { ReasoningContext, EvalResult } from "./types"

const PROVIDER_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? ""

function getClient(): InstanceType<typeof GoogleGenAI> {
  const key = PROVIDER_KEY
  if (!key) throw new Error("Eval provider key not configured")
  return new GoogleGenAI({ apiKey: key })
}

function buildPrompt(ctx: ReasoningContext): string {
  const contextLines: string[] = []
  if (ctx.episodeTitle) contextLines.push(`Episode: "${ctx.episodeTitle}".`)
  if (ctx.sceneNumber != null) contextLines.push(`Scene ${ctx.sceneNumber}.`)
  if (ctx.sceneDialogue) contextLines.push(`Scene dialogue: "${ctx.sceneDialogue}".`)
  const contextBlock = contextLines.length > 0 ? `\nContext: ${contextLines.join(" ")}` : ""
  return `You evaluate a child's answer (ages 4-10) for a storybook checkpoint. Consider BOTH their drawing and spoken answer.
Consider the drawing spatially: what they drew, where they drew it, and what intent or understanding it shows. A child's drawing can show understanding even if their words are unclear.
Question: "${ctx.question}". Expected answer (flexible): "${ctx.expected}".
Child said: "${ctx.transcript || "(no speech)"}".${contextBlock}
Be lenient: accept synonyms, partial matches, and creative answers that show understanding.
Return valid JSON only: {"correct": true or false, "feedback": "Brief encouraging feedback for the child"}`
}

export async function runMultimodalEval(
  ctx: ReasoningContext,
  imageB64?: string | null
): Promise<EvalResult> {
  const client = getClient()
  const parts: ReturnType<typeof createPartFromText>[] = []
  if (imageB64) {
    parts.push(createPartFromBase64(imageB64, "image/png"))
  }
  parts.push(createPartFromText(buildPrompt(ctx)))

  const response = await client.models.generateContent({
    model: "gemini-2.0-flash",
    contents: parts,
    config: {
      maxOutputTokens: 150,
      temperature: 0.3,
    },
  })

  const raw = response.text?.trim() ?? ""
  const match = raw.match(/\{[\s\S]*\}/)
  const parsed = match ? JSON.parse(match[0]) : { correct: false, feedback: "Let's try again!" }
  return {
    correct: Boolean(parsed.correct),
    feedback: parsed.feedback ?? (parsed.correct ? "Great job!" : "Try again!"),
  }
}

export function isEvalConfigured(): boolean {
  return Boolean(PROVIDER_KEY)
}
