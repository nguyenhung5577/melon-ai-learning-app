import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/server/firebase-admin";
import Stripe from "stripe";

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

    // Xác thực danh tính qua Firebase
    const decoded = await adminAuth().verifyIdToken(token);
    const parentUid = decoded.uid;

    const returnUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
    const stripe = getStripe();

    // Khởi tạo phiên giao dịch bên Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      client_reference_id: parentUid, // Dấu vết cực kỳ quan trọng để webhook nhận diện
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Melon Pro VIP",
              description: "Không giới hạn tài khoản con, mở khóa gia sư AI và trợ lý Toán học.",
            },
            unit_amount: 999, // 9.99 USD
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${returnUrl}/parent?payment=success`,
      cancel_url: `${returnUrl}/pricing?payment=cancelled`,
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: unknown) {
    console.error("Stripe Checkout Error:", error);
    const message = error instanceof Error ? error.message : "Lỗi khởi tạo thanh toán";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
