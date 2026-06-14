/**
 * Core types for inference pipelines. Do not expose provider-specific symbols.
 */

export interface MultimodalPayload {
  textSegments: string[]
  imageB64?: string
  imageMime?: string
}

export interface ReasoningContext {
  question: string
  expected: string
  transcript: string
  episodeTitle?: string
  sceneDialogue?: string
  sceneNumber?: number
}

export interface EvalResult {
  correct: boolean
  feedback: string
}

export interface SpeechToTextInput {
  audio: Blob
  mime: string
  language: string
}

export interface SpeechToTextResult {
  text: string
}
