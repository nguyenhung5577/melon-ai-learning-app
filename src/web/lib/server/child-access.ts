import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/server/firebase-admin";

type AccessMode = "read" | "write";

export type ChildAccessContext = {
  callerUid: string;
  callerRole?: string;
  childUid: string;
};

export function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

export async function requireChildAccess(
  req: NextRequest,
  childUid: string,
  mode: AccessMode
): Promise<{ ok: true; context: ChildAccessContext } | { ok: false; response: NextResponse }> {
  const token = getBearerToken(req);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Missing auth token." }, { status: 401 }),
    };
  }

  try {
    const decoded = await adminAuth().verifyIdToken(token);
    const callerUid = decoded.uid;
    const db = adminDb();
    const callerSnap = await db.collection("users").doc(callerUid).get();
    const callerData = callerSnap.data();
    const callerRole = callerData?.role;

    if (callerRole === "admin") {
      return { ok: true, context: { callerUid, callerRole, childUid } };
    }

    if (childUid === "demo-child" && mode === "read") {
      return { ok: true, context: { callerUid, callerRole, childUid } };
    }

    if (callerRole === "kid" && callerUid === childUid) {
      return { ok: true, context: { callerUid, callerRole, childUid } };
    }

    if (mode === "read" && callerRole === "parent") {
      const childSnap = await db.collection("children").doc(childUid).get();
      if (childSnap.exists && childSnap.data()?.linkedParentUid === callerUid) {
        return { ok: true, context: { callerUid, callerRole, childUid } };
      }
    }

    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid auth token." }, { status: 401 }),
    };
  }
}
