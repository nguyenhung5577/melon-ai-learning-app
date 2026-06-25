import { NextResponse } from "next/server";
import Stripe from "stripe";
import type { Firestore } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

function unixToIso(value?: number | null) {
  return value ? new Date(value * 1000).toISOString() : null;
}

function subscriptionCurrentPeriodEnd(subscription: Stripe.Subscription) {
  const value = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  return unixToIso(value);
}

function subscriptionCancelAtPeriodEnd(subscription: Stripe.Subscription) {
  return Boolean((subscription as Stripe.Subscription & { cancel_at_period_end?: boolean }).cancel_at_period_end);
}

async function syncUserPlan(
  db: Firestore,
  parentUid: string,
  plan: "free" | "pro",
  status: "active" | "inactive",
  extra: Record<string, unknown> = {}
) {
  await db.collection("users").doc(parentUid).set({
    isPro: plan === "pro" && status === "active",
    plan,
    subscriptionStatus: status,
    subscriptionUpdatedAt: new Date().toISOString(),
    ...extra,
  }, { merge: true });
}

async function findParentUidByCustomer(db: Firestore, customerId: string) {
  const snapshot = await db.collection("subscriptions")
    .where("stripeCustomerId", "==", customerId)
    .limit(1)
    .get();
  return snapshot.empty ? null : snapshot.docs[0].id;
}

export async function POST(req: Request) {
  // Bắt buộc phải đọc dạng chuỗi (text) thô để Stripe kiểm chứng chữ ký số
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Thiếu chữ ký bảo mật" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    // Xác minh đây là tin nhắn thật từ máy chủ Stripe chứ không phải hacker giả mạo
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid webhook signature";
    console.error(`Lỗi giải mã Webhook: ${message}`);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const db = adminDb();

  try {
    // Xử lý các kịch bản trả tiền
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const parentUid = session.client_reference_id; // UID gửi đi từ lúc khởi tạo Checkout
        
        if (!parentUid) {
          console.error("Không tìm thấy client_reference_id trong session.");
          break;
        }

        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const subscription = subscriptionId
          ? await stripe.subscriptions.retrieve(subscriptionId)
          : null;
        const currentPeriodEnd = subscription ? subscriptionCurrentPeriodEnd(subscription) : null;
        const cancelAtPeriodEnd = subscription ? subscriptionCancelAtPeriodEnd(subscription) : false;

        // Tự động nâng cấp tài khoản lên Melon Pro
        await db.collection("subscriptions").doc(parentUid).set({
          plan: "pro",
          status: "active",
          startedAt: new Date().toISOString(),
          expiresAt: currentPeriodEnd,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        await syncUserPlan(db, parentUid, "pro", "active", {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          proExpiresAt: currentPeriodEnd,
        });
        
        console.log(`[Thành công] Đã cấp gói Pro cho Parent UID: ${parentUid}`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = String(subscription.customer);
        const parentUid = await findParentUidByCustomer(db, customerId);
        if (!parentUid) break;

        const currentPeriodEnd = subscriptionCurrentPeriodEnd(subscription);
        const cancelAtPeriodEnd = subscriptionCancelAtPeriodEnd(subscription);
        const active = subscription.status === "active" || subscription.status === "trialing";
        const plan: "free" | "pro" = active ? "pro" : "free";
        const status: "active" | "inactive" = active ? "active" : "inactive";

        await db.collection("subscriptions").doc(parentUid).set({
          plan,
          status,
          expiresAt: currentPeriodEnd,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        await syncUserPlan(db, parentUid, plan, status, {
          proExpiresAt: currentPeriodEnd,
          stripeSubscriptionId: subscription.id,
        });
        break;
      }
      
      case "customer.subscription.deleted": {
        // Sự kiện: Phụ huynh chủ động hủy gia hạn gói hoặc thẻ hết tiền không thể gia hạn
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = String(subscription.customer);
        const parentUid = await findParentUidByCustomer(db, customerId);

        if (parentUid) {
          const currentPeriodEnd = subscriptionCurrentPeriodEnd(subscription);
          const cancelAtPeriodEnd = subscriptionCancelAtPeriodEnd(subscription);
          const periodEndMs = currentPeriodEnd ? new Date(currentPeriodEnd).getTime() : 0;
          const keepUntilPeriodEnd = cancelAtPeriodEnd && periodEndMs > Date.now();
          const plan: "free" | "pro" = keepUntilPeriodEnd ? "pro" : "free";
          const status: "active" | "inactive" = keepUntilPeriodEnd ? "active" : "inactive";

          await db.collection("subscriptions").doc(parentUid).set({
            plan,
            status,
            expiresAt: currentPeriodEnd,
            currentPeriodEnd,
            cancelAtPeriodEnd,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          await syncUserPlan(db, parentUid, plan, status, {
            proExpiresAt: currentPeriodEnd,
            stripeSubscriptionId: subscription.id,
          });
          console.log(`[Hủy gói] Parent UID ${parentUid}: ${keepUntilPeriodEnd ? "giữ Pro đến cuối kỳ" : "đã xuống Free"}`);
        }
        break;
      }
      
      default:
        console.log(`Chưa xử lý sự kiện: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    console.error("Lỗi khi xử lý CSDL từ Webhook:", err);
    return NextResponse.json({ error: "Lỗi kết nối CSDL" }, { status: 500 });
  }
}
