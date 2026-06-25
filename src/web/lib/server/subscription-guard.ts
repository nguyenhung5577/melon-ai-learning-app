import { getUserSubscription, getEntitlements } from "../subscription/subscription-service";
import { adminAuth, adminDb } from "@/lib/server/firebase-admin";

/**
 * Middleware kiểu bọc (Guard) để dùng trong các file route.ts (API backend).
 * Nhiệm vụ: Xác minh token, tra cứu gói cước, và quyết định cho đi tiếp hay chặn (402/403).
 */
export async function requireEntitlement(
  token: string, 
  feature: keyof import("../subscription/types").Entitlements
): Promise<{ allowed: boolean; error?: string; requiredPlan?: string }> {
  try {
    const auth = adminAuth();
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;

    const db = adminDb();
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
       return { allowed: false, error: "user_not_found" };
    }
    const userData = userSnap.data();

    // 1. ADMIN BYPASS: Role admin có full quyền, không cần mua gói
    if (userData?.role === "admin") {
      return { allowed: true };
    }

    // 2. XÁC ĐỊNH PARENT UID: Child account sẽ dùng ké gói cước của Parent
    let parentUid = uid;
    if (userData?.role === "kid") {
      if (!userData.linkedParentUid) {
         return { allowed: false, error: "child_has_no_parent" };
      }
      parentUid = userData.linkedParentUid;
    }

    // 3. TRA CỨU QUYỀN
    const sub = await getUserSubscription(parentUid);
    const entitlements = getEntitlements(sub);

    // 4. CHẶN / CHO PHÉP (Chỉ check các quyền mang tính Boolean)
    if (typeof entitlements[feature] === "boolean") {
       if (entitlements[feature] === true) {
         return { allowed: true };
       } else {
         return { allowed: false, error: "subscription_required", requiredPlan: "pro" };
       }
    }

    return { allowed: true };

  } catch {
    return { allowed: false, error: "invalid_token_or_internal_error" };
  }
}

/**
 * Helper dành riêng cho API tạo Child (Bởi vì nó kiểm tra giới hạn dạng số chứ không phải boolean)
 */
export async function checkMaxChildrenLimit(
  parentUid: string
): Promise<{ allowed: boolean; currentCount: number; maxAllowed: number }> {
    const db = adminDb();
    
    // Đếm số lượng child hiện có của Parent này
    const childrenQuery = await db.collection("children").where("linkedParentUid", "==", parentUid).count().get();
    const currentCount = childrenQuery.data().count;

    const sub = await getUserSubscription(parentUid);
    const entitlements = getEntitlements(sub);

    return { 
        allowed: currentCount < entitlements.maxChildren,
        currentCount,
        maxAllowed: entitlements.maxChildren
    };
}
