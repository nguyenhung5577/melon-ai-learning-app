import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const ChildLoginSchema = z.object({
  loginId: z.string().trim().min(3).max(24),
  passwordOrPin: z.string().min(4).max(128),
});

export async function POST(req: NextRequest) {
  const body = ChildLoginSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  return NextResponse.json(
    {
      error:
        "Child login backend is not implemented yet. Validate loginId/passwordOrPin server-side and return { customToken }.",
      contract: {
        input: { loginId: "string", passwordOrPin: "string" },
        output: { customToken: "Firebase custom token for childUid" },
      },
    },
    { status: 501 }
  );
}
