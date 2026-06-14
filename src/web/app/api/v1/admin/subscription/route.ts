import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/server/firebase-admin";

function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

export async function POST(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

  try {
    const auth = adminAuth();
    const decoded = await auth.verifyIdToken(token);
    const db = adminDb();
    
    // Yêu cầu quyền Admin
    const adminSnap = await db.collection("users").doc(decoded.uid).get();
    if (adminSnap.data()?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { targetUid, plan } = await req.json();
    if (!targetUid || !plan) {
      return NextResponse.json({ error: "Missing targetUid or plan" }, { status: 400 });
    }

    const now = new Date().toISOString();
    await db.collection("subscriptions").doc(targetUid).set({
      plan,
      status: "active",
      startedAt: now,
      expiresAt: null // Vĩnh viễn (cho Phase 1)
    }, { merge: true });

    return NextResponse.json({ success: true, targetUid, plan });
  } catch (err) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
