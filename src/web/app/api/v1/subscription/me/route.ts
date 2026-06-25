import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/server/firebase-admin";
import { getUserSubscription, getEntitlements } from "@/lib/subscription/subscription-service";
import type { Subscription } from "@/lib/subscription/types";

function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

export async function GET(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

  try {
    const auth = adminAuth();
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;

    const db = adminDb();
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.data();

    // 1. ADMIN BYPASS
    if (userData?.role === "admin") {
      const proSub: Subscription = { plan: "pro", status: "active", startedAt: new Date().toISOString(), expiresAt: null };
      return NextResponse.json({ 
        subscription: proSub, 
        entitlements: getEntitlements(proSub),
        isPro: true 
      });
    }

    // 2. CHILD ACCOUNT -> DÙNG GÓI CỦA PARENT
    let parentUid = uid;
    if (userData?.role === "kid" && userData.linkedParentUid) {
       parentUid = userData.linkedParentUid;
    }

    // 3. FETCH SUBSCRIPTION & ENTITLEMENTS
    const subscription = await getUserSubscription(parentUid);
    const entitlements = getEntitlements(subscription);

    return NextResponse.json({ 
      subscription, 
      entitlements, 
      isPro: subscription.plan === "pro" 
    });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
