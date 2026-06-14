/**
 * Centralised env reader — all config reads go through here.
 * Missing required vars throw at startup in production.
 */

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val ?? "";
}

function optionalEnv(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export const config = {
  // Firebase
  firebase: {
    apiKey:            requireEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain:        requireEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId:         requireEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket:     optionalEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: optionalEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId:             requireEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
  },

  // OpenAI
  openai: {
    apiKey: requireEnv("OPENAI_API_KEY"),
    model:  optionalEnv("OPENAI_MODEL", "gpt-4o-mini"),
  },

  // Pinecone (RAG)
  pinecone: {
    apiKey:    requireEnv("PINECONE_API_KEY"),
    indexName: optionalEnv("PINECONE_INDEX", "melon-lessons"),
    namespace: optionalEnv("PINECONE_NAMESPACE", "default"),
  },

  // ElevenLabs (TTS)
  elevenlabs: {
    apiKey:  requireEnv("ELEVENLABS_API_KEY"),
    voiceId: optionalEnv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM"), // Rachel
  },

  // App
  app: {
    url:      optionalEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
    env:      optionalEnv("NODE_ENV", "development"),
    isProd:   process.env.NODE_ENV === "production",
    isDev:    process.env.NODE_ENV === "development",
  },
} as const;
