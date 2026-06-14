const DEFAULT_BACKEND_URL = "http://127.0.0.1:8001";

export function getMelonAiBackendUrl(): string {
  return (process.env.MELON_AI_BACKEND_URL ?? DEFAULT_BACKEND_URL).replace(/\/+$/, "");
}

export function getMelonAiEndpoint(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getMelonAiBackendUrl()}${normalizedPath}`;
}
