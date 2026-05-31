import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const CreateChildSchema = z.object({
  loginId: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/),
  displayName: z.string().trim().min(2).max(30),
  passwordOrPin: z.string().min(4).max(128),
  grade: z.string().min(1).max(40),
  avatarEmoji: z.string().min(1).max(8),
});

export async function POST(req: NextRequest) {
  const body = CreateChildSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  return NextResponse.json(
    {
      error:
        "Create child backend is not implemented yet. Verify parent auth, create child user/profile, hash credential, and return { child }.",
      contract: {
        input: {
          loginId: "unique child login id",
          displayName: "child display name",
          passwordOrPin: "raw secret received only by backend",
          grade: "grade label",
          avatarEmoji: "selected avatar",
        },
        output: {
          child: {
            uid: "childUid",
            loginId: "loginId",
            displayName: "displayName",
            grade: "grade",
            avatarEmoji: "avatarEmoji",
            linkedParentUid: "parentUid",
          },
        },
      },
    },
    { status: 501 }
  );
}
