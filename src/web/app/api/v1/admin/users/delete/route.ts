import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/server/firebase-admin";

function getErrorMessage(error: unknown, fallback = "Internal Server Error") {
  return error instanceof Error ? error.message : fallback;
}

function getErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
}

export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split("Bearer ")[1];
    const decoded = await adminAuth().verifyIdToken(token);
    
    // Kiểm tra quyền Admin
    const callerSnap = await adminDb().collection("users").doc(decoded.uid).get();
    if (callerSnap.data()?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { targetUid, type } = await req.json();
    if (!targetUid || !type) {
      return NextResponse.json({ error: "Missing targetUid or type" }, { status: 400 });
    }

    const auth = adminAuth();
    const db = adminDb();

    if (type === "child") {
      // 1. Tìm và xóa thẻ tên đăng nhập để nhả Login ID cho người khác xài
      const childSnap = await db.collection("children").doc(targetUid).get();
      if (childSnap.exists) {
        const childData = childSnap.data();
        if (childData?.loginId) {
          await db.collection("childCredentials").doc(childData.loginId).delete();
        }
        await db.collection("children").doc(targetUid).delete();
      }
      
      // 2. Xóa khỏi Auth
      try {
        await auth.deleteUser(targetUid);
      } catch (error: unknown) {
        if (getErrorCode(error) !== "auth/user-not-found") throw error;
      }

      return NextResponse.json({ success: true });

    } else if (type === "parent") {
      // 1. Quét tìm toàn bộ tài khoản con
      const childrenSnap = await db.collection("children").where("linkedParentUid", "==", targetUid).get();
      
      const batch = db.batch();
      const childUidsToDelete: string[] = [];

      for (const doc of childrenSnap.docs) {
        const childData = doc.data();
        childUidsToDelete.push(doc.id);
        
        if (childData.loginId) {
          batch.delete(db.collection("childCredentials").doc(childData.loginId));
        }
        batch.delete(doc.ref);
      }

      // Xóa hàng loạt dữ liệu con
      await batch.commit();

      // Xóa toàn bộ con khỏi Auth
      for (const cuid of childUidsToDelete) {
        try {
          await auth.deleteUser(cuid);
        } catch (error: unknown) {
          if (getErrorCode(error) !== "auth/user-not-found") console.error("Error deleting child auth", error);
        }
      }

      // 2. Xóa dữ liệu Phụ huynh
      await db.collection("users").doc(targetUid).delete();
      await db.collection("subscriptions").doc(targetUid).delete();

      // 3. Xóa Phụ huynh khỏi Auth
      try {
        await auth.deleteUser(targetUid);
      } catch (error: unknown) {
        if (getErrorCode(error) !== "auth/user-not-found") throw error;
      }

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

  } catch (error: unknown) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
