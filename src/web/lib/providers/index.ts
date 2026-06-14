/**
 * Inference pipelines: multimodal eval and speech-to-text.
 * All provider-specific configuration is read from env; no symbols are exposed.
 */

export {
  runMultimodalEval,
  isEvalConfigured,
} from "./multimodal-eval"
export {
  runSpeechToText,
  isTranscriptConfigured,
} from "./speech-to-text"
export type { ReasoningContext, EvalResult, SpeechToTextInput, SpeechToTextResult } from "./types"
