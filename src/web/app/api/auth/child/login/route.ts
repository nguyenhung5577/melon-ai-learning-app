import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";

const ChildLoginSchema = z.object({
  loginId: z.string().trim().min(3, "Mã học sinh cần có ít nhất 3 ký tự.").max(24, "Mã học sinh tối đa 24 ký tự."),
  passwordOrPin: z.string().min(4, "PIN hoặc mật khẩu cần có ít nhất 4 ký tự.").max(128, "PIN hoặc mật khẩu tối đa 128 ký tự."),
});

export async function POST(req: NextRequest) {
  const body = ChildLoginSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.issues[0]?.message ?? "Thông tin đăng nhập chưa hợp lệ." }, { status: 400 });
  }

  try {
    const loginIdLower = body.data.loginId.trim().toLowerCase();
    const credentialSnap = await adminDb().collection("childCredentials").doc(loginIdLower).get();
    const credential = credentialSnap.data();

    if (!credentialSnap.exists || credential?.disabled || !credential?.passwordHash || !credential?.childUid) {
      return NextResponse.json({ error: "Login ID hoặc PIN không đúng." }, { status: 401 });
    }

    const passwordMatches = await bcrypt.compare(body.data.passwordOrPin, credential.passwordHash);
    if (!passwordMatches) {
      return NextResponse.json({ error: "Login ID hoặc PIN không đúng." }, { status: 401 });
    }

    const userSnap = await adminDb().collection("users").doc(credential.childUid).get();
    if (!userSnap.exists || userSnap.data()?.role !== "kid") {
      return NextResponse.json({ error: "Tài khoản học sinh không khả dụng." }, { status: 401 });
    }

    const customToken = await adminAuth().createCustomToken(credential.childUid);
    return NextResponse.json({ customToken });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không đăng nhập được tài khoản học sinh." },
      { status: 500 }
    );
  }
}
