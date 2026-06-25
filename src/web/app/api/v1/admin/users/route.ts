import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/server/firebase-admin";

interface AdminUserDoc {
  uid: string;
  email?: string;
  displayName?: string;
  createdAt?: string;
  isPro?: boolean;
  plan?: "free" | "pro";
  linkedParentUid?: string;
  loginId?: string;
  avatarEmoji?: string;
  grade?: string;
}

interface SubscriptionDoc {
  plan?: "free" | "pro";
}

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.split("Bearer ")[1];
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Kiểm tra quyền Admin
    const decoded = await adminAuth().verifyIdToken(token);
    const userDoc = await adminDb().collection("users").doc(decoded.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Not an admin" }, { status: 403 });
    }

    // 2. Fetch toàn bộ Parents
    const parentsSnapshot = await adminDb().collection("users").where("role", "==", "parent").get();
    const parents: AdminUserDoc[] = parentsSnapshot.docs.map(doc => ({
      ...(doc.data() as Omit<AdminUserDoc, "uid">),
      uid: doc.id,
    }));

    // 3. Fetch toàn bộ Kids
    const kidsSnapshot = await adminDb().collection("users").where("role", "==", "kid").get();
    const kids: AdminUserDoc[] = kidsSnapshot.docs.map(doc => ({
      ...(doc.data() as Omit<AdminUserDoc, "uid">),
      uid: doc.id,
    }));

    // 4. Fetch toàn bộ Subscriptions
    const subsSnapshot = await adminDb().collection("subscriptions").get();
    const subscriptions = subsSnapshot.docs.reduce((acc, doc) => {
      acc[doc.id] = doc.data() as SubscriptionDoc;
      return acc;
    }, {} as Record<string, SubscriptionDoc>);

    // 5. Kết hợp dữ liệu (Merge)
    const result = parents.map(parent => {
      const parentKids = kids.filter((k) => k.linkedParentUid === parent.uid);
      const sub = subscriptions[parent.uid] || { plan: "free" };
      const plan = sub.plan || (parent.isPro ? "pro" : parent.plan) || "free";
      
      return {
        uid: parent.uid,
        email: parent.email || parent.uid, // Fallback nếu login bằng số điện thoại
        displayName: parent.displayName || "Unknown Parent",
        createdAt: parent.createdAt,
        plan,
        childrenCount: parentKids.length,
        children: parentKids.map((k) => ({
          uid: k.uid,
          loginId: k.loginId,
          displayName: k.displayName || "Learner",
          avatarEmoji: k.avatarEmoji || "👤",
          grade: k.grade || "Unknown",
        })),
      };
    });

    // Sắp xếp ngày tạo mới nhất lên trên
    result.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({ users: result });

  } catch (error) {
    console.error("Admin Users GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
