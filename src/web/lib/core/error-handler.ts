import { ApiError } from "./query-client";

interface AppError {
  title: string;
  message: string;
  retryable: boolean;
}

export function parseError(err: unknown): AppError {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return {
        title: "Not logged in",
        message: "Please sign in to continue.",
        retryable: false,
      };
    }
    if (err.status === 403) {
      return {
        title: "Access denied",
        message: "You don't have permission to do that.",
        retryable: false,
      };
    }
    if (err.status === 429) {
      return {
        title: "Too many requests",
        message: "Slow down a bit! Try again in a moment.",
        retryable: true,
      };
    }
    if (err.status >= 500) {
      return {
        title: "Server error",
        message: "Something went wrong on our end. Please try again.",
        retryable: true,
      };
    }
    return {
      title: "Request failed",
      message: err.message || "Unknown error",
      retryable: false,
    };
  }

  if (err instanceof Error) {
    // Network / CORS
    if (err.message.includes("fetch")) {
      return {
        title: "Network error",
        message: "Check your internet connection.",
        retryable: true,
      };
    }
    return { title: "Error", message: err.message, retryable: false };
  }

  return { title: "Unexpected error", message: String(err), retryable: false };
}
