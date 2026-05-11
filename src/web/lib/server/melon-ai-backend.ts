const DEFAULT_BACKEND_URL = "http://localhost:8000";

export function getMelonAiBackendUrl(): string {
  return (process.env.MELON_AI_BACKEND_URL ?? DEFAULT_BACKEND_URL).replace(/\/+$/, "");
}

export function getMelonAiEndpoint(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getMelonAiBackendUrl()}${normalizedPath}`;
}
