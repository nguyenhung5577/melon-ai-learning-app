import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/server/firebase-admin";

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }
  return new Stripe(secretKey);
}

function getWebhookSecret() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  }
  return webhookSecret;
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
    const stripe = getStripe();
    const webhookSecret = getWebhookSecret();
    // Xác minh đây là tin nhắn thật từ máy chủ Stripe chứ không phải hacker giả mạo
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Lỗi giải mã Webhook";
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

        // Tự động nâng cấp tài khoản lên Melon Pro
        await db.collection("subscriptions").doc(parentUid).set({
          plan: "pro",
          status: "active",
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        
        console.log(`[Thành công] Đã cấp gói Pro cho Parent UID: ${parentUid}`);
        break;
      }
      
      case "customer.subscription.deleted": {
        // Sự kiện: Phụ huynh chủ động hủy gia hạn gói hoặc thẻ hết tiền không thể gia hạn
        const subscription = event.data.object as Stripe.Subscription;
        
        const snapshot = await db.collection("subscriptions")
          .where("stripeCustomerId", "==", subscription.customer)
          .get();

        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          await doc.ref.set({
            plan: "free",
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          console.log(`[Hủy gói] Đã giáng cấp Parent UID: ${doc.id} xuống Free`);
        }
        break;
      }
      
      default:
        console.log(`Chưa xử lý sự kiện: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error("Lỗi khi xử lý CSDL từ Webhook:", error);
    return NextResponse.json({ error: "Lỗi kết nối CSDL" }, { status: 500 });
  }
}
