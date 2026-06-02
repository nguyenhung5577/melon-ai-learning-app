import { NextRequest, NextResponse } from "next/server";
import { getMelonAiEndpoint } from "@/lib/server/melon-ai-backend";
import { ProblemParseResponseSchema } from "@/lib/problems/schema";

function formatUnknownError(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Lỗi không xác định";
  }
}

async function forwardMultipart(req: NextRequest): Promise<Response> {
  const incoming = await req.formData();
  const outgoing = new FormData();

  for (const [key, value] of incoming.entries()) {
    if (value instanceof File) {
      outgoing.append(key, value, value.name);
    } else {
      outgoing.append(key, value);
    }
  }

  return fetch(getMelonAiEndpoint("/api/v1/problems/parse"), {
    method: "POST",
    body: outgoing,
    cache: "no-store",
  });
}

async function forwardJson(req: NextRequest): Promise<Response> {
  return fetch(getMelonAiEndpoint("/api/v1/problems/parse"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(await req.json()),
    cache: "no-store",
  });
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    const res = contentType.includes("multipart/form-data")
      ? await forwardMultipart(req)
      : await forwardJson(req);

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    const parsed = ProblemParseResponseSchema.safeParse(data);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
        .join("; ");
      return NextResponse.json(
        {
          error: "Invalid parser output",
          detail: issues || formatUnknownError(parsed.error.flatten()),
          validation: parsed.error.flatten(),
        },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed.data);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Cannot connect to melon-ai-backend problem parser",
        detail: formatUnknownError(error),
      },
      { status: 502 }
    );
  }
}
