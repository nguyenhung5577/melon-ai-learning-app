import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/server/firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

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
  } catch (err: any) {
    console.error(`Lỗi giải mã Webhook: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 400 });
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
  } catch (err: any) {
    console.error("Lỗi khi xử lý CSDL từ Webhook:", err);
    return NextResponse.json({ error: "Lỗi kết nối CSDL" }, { status: 500 });
  }
}
