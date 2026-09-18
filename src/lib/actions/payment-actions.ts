"use server";

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/utils/activity-logger";
import {
  markOrderFailed,
  PLAN_CURRENCY,
  PLAN_PRICE_PAISE,
  PREMIUM_BOOSTS_GRANT,
} from "@/lib/actions/premium";
import { isValidOrderId, safeStatusToken } from "@/lib/actions/safety";
import {
  paymentVerificationLogAction,
  verifyProviderAmountAndCurrency,
} from "@/lib/actions/payment-verification";
import { fulfillPremiumOrder } from "@/lib/actions/payment-fulfillment";
import { consumeRateLimit, rateLimitUserMessage, RATE_LIMITS } from "@/lib/rate-limit";

const CASHFREE_API_BASE =
  process.env.NEXT_PUBLIC_CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

/** Provider calls must not hang a Server Action / route handler. */
const PROVIDER_TIMEOUT_MS = 15_000;

const createOrderResponseSchema = z.object({
  payment_session_id: z.string().min(1).max(2048),
  cf_order_id: z.union([z.string(), z.number()]).optional(),
  order_status: z.string().max(32).optional(),
});

const orderStatusResponseSchema = z.object({
  order_status: z.string().max(32).optional(),
  order_amount: z.union([z.number(), z.string()]).optional(),
  order_currency: z.string().max(8).optional(),
});

export type CreatePremiumOrderResult = {
  success?: boolean;
  orderId?: string;
  paymentSessionId?: string;
  error?: string;
};

export type VerifyPaymentResult = {
  success?: boolean;
  status?: string;
  orderId?: string;
  error?: string;
};

type ProfileRow = { is_premium?: boolean | null; username?: string | null };
type OrderRow = {
  id: string;
  user_id: string;
  status: string | null;
  amount: number | null;
  currency: string | null;
};

function cashfreeCredentials() {
  const clientId = process.env.CASHFREE_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/**
 * Create a Cashfree payment order for the premium upgrade.
 *
 * The order row is written BEFORE the provider is called so the webhook can always
 * resolve `order_id` → owner; a provider failure marks the row FAILED instead of
 * leaving a paid-but-unknown order.
 */
export async function createPremiumOrder(): Promise<CreatePremiumOrderResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Must be logged in" };

  // Provider-facing and writes an order row: throttle per user before either happens.
  // Fails closed in production when the limiter cannot reach a decision.
  const rate = await consumeRateLimit({
    scope: "payment.create_order",
    subject: user.id,
    ...RATE_LIMITS.createPremiumOrder,
  });
  if (!rate.allowed) return { error: rateLimitUserMessage(rate) };

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("is_premium, username")
    .eq("id", user.id)
    .single();

  if (profileError || !profileData) {
    return { error: "Profile not found. Please contact support." };
  }

  const profile = profileData as ProfileRow;

  if (profile.is_premium) {
    return { error: "You're already premium! 👑" };
  }

  const credentials = cashfreeCredentials();
  if (!credentials) {
    console.error("[createPremiumOrder] Cashfree credentials are not configured");
    return { error: "Payment system not configured. Contact support." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    if (process.env.NODE_ENV === "production") {
      console.error("[createPremiumOrder] NEXT_PUBLIC_APP_URL is required in production");
      return { error: "Payment system not configured. Contact support." };
    }
  }
  const baseUrl = appUrl || "http://localhost:3000";

  const admin = getSupabaseAdmin();
  if (!admin) return { error: "Payment system not configured. Contact support." };
  const id = randomUUID();
  const orderId = `auramint_${id}`;

  // 1. Persist the order first (Pending) so a provider success can always be tied
  //    back to this user, even if a later step fails.
  const { error: insertError } = await admin.from("orders").insert({
    id,
    cashfree_order_id: orderId,
    user_id: user.id,
    amount: PLAN_PRICE_PAISE,
    currency: PLAN_CURRENCY,
    status: "PENDING",
    plan: "premium",
  });

  if (insertError) {
    console.error("[createPremiumOrder] Failed to persist order:", insertError.message);
    return { error: "Payment system error. Try again later." };
  }

  try {
    const response = await fetch(`${CASHFREE_API_BASE}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": credentials.clientId,
        "x-client-secret": credentials.clientSecret,
        "x-api-version": process.env.CASHFREE_API_VERSION || "2023-08-01",
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: PLAN_PRICE_PAISE / 100, // Cashfree expects major units (₹)
        order_currency: PLAN_CURRENCY,
        customer_details: {
          customer_id: user.id,
          customer_email: user.email,
          customer_name: profile.username || "AuraMint User",
        },
        order_meta: {
          return_url: `${baseUrl}/api/payments/verify?order_id={order_id}`,
          notify_url: `${baseUrl}/api/webhooks/cashfree`,
        },
        order_note: "AuraMint Premium Subscription",
      }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });

    const parsed = createOrderResponseSchema.safeParse(await response.json().catch(() => null));

    if (!response.ok || !parsed.success) {
      console.error("[createPremiumOrder] Cashfree order creation failed", {
        status: response.status,
        parsed: parsed.success,
      });
      const failed = await markOrderFailed(admin, orderId);
      if (!failed.ok) console.error("[createPremiumOrder] Failure status unavailable:", failed.error);
      return { error: "Payment creation failed. Try again." };
    }

    logActivity(user.id, "payment.order.created", {
      order_id: orderId,
      amount: PLAN_PRICE_PAISE,
    }).catch(() => {});

    return {
      success: true,
      orderId,
      paymentSessionId: parsed.data.payment_session_id,
    };
  } catch (err) {
    console.error("[createPremiumOrder]", err);
    // A transport timeout does not prove provider failure: leave the order retryable.
    return { error: "Payment system error. Try again later." };
  }
}

/**
 * Verify a payment after the user returns from Cashfree.
 *
 * Ownership is proven against the session (`orders.user_id = auth.uid()`), the
 * provider-reported amount/currency are compared with the stored order, and the
 * PAID transition and entitlement grant share one purchase-idempotent transaction.
 */
export async function verifyPayment(orderId: string): Promise<VerifyPaymentResult> {
  if (!isValidOrderId(orderId)) {
    return { error: "Invalid order" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Must be logged in" };

  // Verify ownership
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select("id, user_id, status, amount, currency")
    .eq("cashfree_order_id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (orderError || !orderData) return { error: "Order not found" };
  const order = orderData as OrderRow;

  const credentials = cashfreeCredentials();
  if (!credentials) {
    console.error("[verifyPayment] Cashfree credentials are not configured");
    return { error: "Payment system not configured" };
  }

  try {
    const response = await fetch(`${CASHFREE_API_BASE}/orders/${encodeURIComponent(orderId)}`, {
      headers: {
        "x-client-id": credentials.clientId,
        "x-client-secret": credentials.clientSecret,
        "x-api-version": process.env.CASHFREE_API_VERSION || "2023-08-01",
      },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });

    const parsed = orderStatusResponseSchema.safeParse(await response.json().catch(() => null));

    if (!response.ok || !parsed.success) {
      console.error("[verifyPayment] Provider lookup failed", { status: response.status });
      return { error: "Verification failed" };
    }

    const providerStatus = safeStatusToken(parsed.data.order_status, "PENDING");

    if (providerStatus !== "PAID") {
      return { success: false, status: providerStatus };
    }

    // Amount / currency verification — never grant on a missing, malformed or
    // mismatched value. A broken stored order row used to skip the comparison and
    // fall through to the grant; it now refuses. Shared with the webhook core.
    const verification = verifyProviderAmountAndCurrency(
      { amountMinor: order.amount, currency: order.currency },
      { amountMajor: parsed.data.order_amount, currency: parsed.data.order_currency }
    );

    if (!verification.ok) {
      console.error("[verifyPayment] CRITICAL: refusing to grant premium", {
        orderId,
        reason: verification.reason,
        providerAmount: parsed.data.order_amount ?? null,
        storedAmount: order.amount ?? null,
        providerCurrency: parsed.data.order_currency ?? null,
        storedCurrency: order.currency ?? null,
      });
      logActivity(user.id, paymentVerificationLogAction(verification.reason), {
        order_id: orderId,
        reason: verification.reason,
        provider_amount: parsed.data.order_amount ?? null,
        stored_amount: order.amount ?? null,
        provider_currency: parsed.data.order_currency ?? null,
        stored_currency: order.currency ?? null,
      }).catch(() => {});
      return { error: "Payment verification failed. Contact support." };
    }

    const admin = getSupabaseAdmin();
    if (!admin) return { error: "Payment system not configured" };
    const fulfilled = await fulfillPremiumOrder(admin, orderId, user.id);
    if (!fulfilled.ok) {
      console.error("[verifyPayment] Atomic fulfillment failed:", fulfilled.error);
      return { error: "Upgrade failed. Contact support." };
    }
    if (!fulfilled.applied && !fulfilled.recovered) {
      return { success: true, status: "PAID", orderId };
    }

    logActivity(user.id, "payment.success", {
      order_id: orderId,
      boosts: PREMIUM_BOOSTS_GRANT,
    }).catch(() => {});

    return { success: true, status: "PAID", orderId };
  } catch (err) {
    console.error("[verifyPayment]", err);
    return { error: "Verification failed" };
  }
}
