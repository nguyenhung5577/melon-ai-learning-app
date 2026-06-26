import { NextRequest, NextResponse } from "next/server";
import { getMelonAiEndpoint } from "@/lib/server/melon-ai-backend";
import { ProblemParseResponseSchema } from "@/lib/problems/schema";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/problems/upload-limits";

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
      if (value.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: `File "${value.name}" exceeds ${MAX_UPLOAD_MB}MB limit.` },
          { status: 413 }
        );
      }
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

function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

export async function POST(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
  }

  // --- FREEMIUM GUARD ---
  const { requireEntitlement } = await import("@/lib/server/subscription-guard");
  const guard = await requireEntitlement(token, "canParseProblemsWithAI");
  if (!guard.allowed) {
    return NextResponse.json({ 
      error: guard.error, 
      message: "Vui lòng nâng cấp lên Melon Pro để sử dụng tính năng Bóc tách đề bằng AI.",
      requiredPlan: guard.requiredPlan 
    }, { status: 402 });
  }
  // ----------------------

  try {
    const contentType = req.headers.get("content-type") ?? "";
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (contentType.includes("multipart/form-data") && contentLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `Upload request exceeds ${MAX_UPLOAD_MB}MB limit.` },
        { status: 413 }
      );
    }

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
