import { adminDb } from "@/lib/server/firebase-admin";
import { Subscription, Entitlements, FREE_ENTITLEMENTS, PRO_ENTITLEMENTS } from "./types";

/**
 * Lấy thông tin gói cước từ DB của một user (thường là Parent UID).
 * Nếu user chưa từng mua gói, tự động trả về cấu trúc của gói Free.
 */
export async function getUserSubscription(uid: string): Promise<Subscription> {
  const db = adminDb();
  const subSnap = await db.collection("subscriptions").doc(uid).get();
  
  if (!subSnap.exists) {
    return {
      plan: "free",
      status: "active",
      startedAt: new Date().toISOString(),
      expiresAt: null,
    };
  }

  const data = subSnap.data() as Subscription;
  
  // Kiểm tra hạn sử dụng (Grace period / Expiration logic)
  if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
    data.status = "inactive";
    data.plan = "free"; 
  }

  return data;
}

/**
 * Hàm quy đổi từ thông tin gói cước ra bảng phân quyền (Entitlements)
 */
export function getEntitlements(subscription: Subscription): Entitlements {
  if (subscription.status === "active" && subscription.plan === "pro") {
    return PRO_ENTITLEMENTS;
  }
  return FREE_ENTITLEMENTS;
}
