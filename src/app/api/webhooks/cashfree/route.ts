import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Cashfree webhook handler.
 * Verifies signature, processes PAYMENT_SUCCESS events.
 * ALWAYS returns 200 to prevent retry storms.
 */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[Cashfree Webhook] CRITICAL: CASHFREE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ message: "Server misconfigured" }, { status: 200 });
  }

  try {
    const rawBody = await req.text();
    const timestamp = req.headers.get("x-webhook-timestamp") || "";
    const signature = req.headers.get("x-webhook-signature") || "";

    // Verify signature using timing-safe comparison
    const signaturePayload = timestamp + rawBody;
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(signaturePayload)
      .digest("base64");

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      console.error("[Cashfree Webhook] Invalid signature");
      return NextResponse.json({ message: "Invalid signature" }, { status: 200 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event?.type;
    const orderData = event?.data?.order;

    if (!orderData?.order_id) {
      return NextResponse.json({ message: "No order_id" }, { status: 200 });
    }

    const orderId = orderData.order_id;

    if (eventType === "PAYMENT_SUCCESS_WEBHOOK" || orderData.order_status === "PAID") {
      // Get the order to find user_id
      const { data: order } = await getSupabaseAdmin()
        .from("orders")
        .select("user_id, status")
        .eq("id", orderId)
        .single();

      if (!order) {
        console.error("[Cashfree Webhook] Order not found:", orderId);
        return NextResponse.json({ message: "Order not found" }, { status: 200 });
      }

      // Idempotency check
      if ((order as any).status === "PAID") {
        return NextResponse.json({ message: "Already processed" }, { status: 200 });
      }

      // Upgrade to premium
      await getSupabaseAdmin()
        .from("profiles")
        .update({ is_premium: true })
        .eq("id", (order as any).user_id);

      // Update order status
      await getSupabaseAdmin()
        .from("orders")
        .update({ status: "PAID" })
        .eq("id", orderId);

      // Log activity
      await getSupabaseAdmin().from("activity_log").insert({
        user_id: (order as any).user_id,
        action: "payment.webhook.success",
        metadata: { order_id: orderId },
      });

      console.log("[Cashfree Webhook] Payment success:", orderId);
    } else if (eventType === "PAYMENT_FAILED_WEBHOOK" || orderData.order_status === "FAILED") {
      await getSupabaseAdmin()
        .from("orders")
        .update({ status: "FAILED" })
        .eq("id", orderId);

      console.log("[Cashfree Webhook] Payment failed:", orderId);
    }

    return NextResponse.json({ message: "OK" }, { status: 200 });
  } catch (err) {
    console.error("[Cashfree Webhook] Error:", err);
    // ALWAYS return 200 to prevent retry storms
    return NextResponse.json({ message: "Error processed" }, { status: 200 });
  }
}
