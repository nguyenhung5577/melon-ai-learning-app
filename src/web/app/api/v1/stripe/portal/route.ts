import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminAuth, adminDb } from "@/lib/server/firebase-admin";

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }
  return new Stripe(secretKey);
}

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.split("Bearer ")[1];
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Xác thực người dùng
    const decoded = await adminAuth().verifyIdToken(token);
    const parentUid = decoded.uid;

    // 2. Tìm kiếm Mã Khách hàng (Customer ID) của Stripe lưu trong CSDL
    const subDoc = await adminDb().collection("subscriptions").doc(parentUid).get();
    if (!subDoc.exists) {
      return NextResponse.json({ error: "Tài khoản của bạn chưa đăng ký gói cước nào" }, { status: 400 });
    }

    const stripeCustomerId = subDoc.data()?.stripeCustomerId;
    if (!stripeCustomerId) {
      return NextResponse.json({ error: "Tài khoản này chưa từng giao dịch qua Stripe" }, { status: 400 });
    }

    const returnUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
    const stripe = getStripe();

    // 3. Khởi tạo một cánh cửa thời không (Portal Session) tới trang hóa đơn của Stripe
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${returnUrl}/parent`, // Xử lý xong thì trả về lại trang Dashboard
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error("Lỗi khi tạo Stripe Portal:", error);
    const message = error instanceof Error ? error.message : "Lỗi máy chủ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
