"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/utils/activity-logger";

const CASHFREE_API_BASE = process.env.NEXT_PUBLIC_CASHFREE_ENV === "production"
  ? "https://api.cashfree.com/pg"
  : "https://sandbox.cashfree.com/pg";

const PLAN_PRICE = 9900; // ₹99 in paise

/**
 * Create a Cashfree payment order for premium upgrade.
 */
export async function createPremiumOrder() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Must be logged in" };

  // Check if already premium
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium, username")
    .eq("id", user.id)
    .single();

  if ((profile as any)?.is_premium) {
    return { error: "You're already premium! 👑" };
  }

  const clientId = process.env.CASHFREE_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { error: "Payment system not configured. Contact support." };
  }

  const orderId = `auramint_${user.id.slice(0, 8)}_${Date.now()}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const response = await fetch(`${CASHFREE_API_BASE}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": clientId,
        "x-client-secret": clientSecret,
        "x-api-version": process.env.CASHFREE_API_VERSION || "2023-08-01",
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: PLAN_PRICE / 100, // Cashfree expects amount in rupees
        order_currency: "INR",
        customer_details: {
          customer_id: user.id,
          customer_email: user.email,
          customer_name: (profile as any)?.username || "AuraMint User",
        },
        order_meta: {
          return_url: `${appUrl}/api/payments/verify?order_id={order_id}`,
          notify_url: `${appUrl}/api/webhooks/cashfree`,
        },
        order_note: "AuraMint Premium Subscription",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[createPremiumOrder] Cashfree error:", data);
      return { error: "Payment creation failed. Try again." };
    }

    // Store order in DB
    await supabase.from("orders").insert({
      id: orderId,
      user_id: user.id,
      amount: PLAN_PRICE,
      currency: "INR",
      status: "PENDING",
      payment_provider: "cashfree",
      provider_order_id: data.cf_order_id,
    });

    logActivity(user.id, "payment.order.created", { order_id: orderId, amount: PLAN_PRICE }).catch(() => {});

    return {
      success: true,
      orderId,
      paymentSessionId: data.payment_session_id,
    };
  } catch (err) {
    console.error("[createPremiumOrder]", err);
    return { error: "Payment system error. Try again later." };
  }
}

/**
 * Verify payment status after user returns from Cashfree.
 */
export async function verifyPayment(orderId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Must be logged in" };

  // Verify ownership
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .single();

  if (!order) return { error: "Order not found" };

  const clientId = process.env.CASHFREE_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { error: "Payment system not configured" };
  }

  try {
    const response = await fetch(`${CASHFREE_API_BASE}/orders/${orderId}`, {
      headers: {
        "x-client-id": clientId,
        "x-client-secret": clientSecret,
        "x-api-version": process.env.CASHFREE_API_VERSION || "2023-08-01",
      },
    });

    const data = await response.json();

    if (data.order_status === "PAID") {
      // Upgrade to premium + grant 5 boosts
      await supabase
        .from("profiles")
        .update({ is_premium: true, boosts_remaining: 5 })
        .eq("id", user.id);

      await supabase
        .from("orders")
        .update({ status: "PAID" })
        .eq("id", orderId);

      logActivity(user.id, "payment.success", { order_id: orderId }).catch(() => {});

      return { success: true, status: "PAID" };
    }

    return { success: false, status: data.order_status };
  } catch (err) {
    console.error("[verifyPayment]", err);
    return { error: "Verification failed" };
  }
}
