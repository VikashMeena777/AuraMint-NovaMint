import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  logPaymentEvent,
  markOrderFailed,
} from "@/lib/actions/premium";
import {
  handleCashfreeWebhookEvent,
  type WebhookDeps,
  type WebhookOrderRow,
} from "@/lib/actions/payment-webhook";
import { fulfillPremiumOrder } from "@/lib/actions/payment-fulfillment";

/**
 * Cashfree webhook handler.
 *
 * All security decisions live in `handleCashfreeWebhookEvent` (unit tested); this
 * handler only wires the service-role client and the response.
 *
 * Status codes: 401 invalid signature, 400 malformed payload, 503 misconfigured,
 * 500 transient failure (provider retries), 200 handled/ignored.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Reject absurd payloads before parsing them. */
const MAX_BODY_BYTES = 256 * 1024;

function createWebhookDeps(supabase: SupabaseClient): WebhookDeps {
  return {
    async getOrder(orderId) {
      const { data, error } = await supabase
        .from("orders")
        .select("id, user_id, status, amount, currency")
        .eq("cashfree_order_id", orderId)
        .maybeSingle();

      if (error) return { order: null, error: error.message };
      return { order: (data as WebhookOrderRow | null) ?? null };
    },

    fulfillOrder(orderId, userId) {
      return fulfillPremiumOrder(supabase, orderId, userId);
    },

    markOrderFailed(orderId) {
      return markOrderFailed(supabase, orderId);
    },

    logEvent(userId, action, metadata) {
      return logPaymentEvent(supabase, userId, action, metadata);
    },
  };
}

export async function POST(req: NextRequest) {
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ message: "Payload too large" }, { status: 413 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[Cashfree Webhook] CRITICAL: Supabase service-role env is not configured");
    return NextResponse.json({ message: "Server misconfigured" }, { status: 503 });
  }

  try {
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ message: "Payload too large" }, { status: 413 });
    }

    const outcome = await handleCashfreeWebhookEvent({
      rawBody,
      timestamp: req.headers.get("x-webhook-timestamp"),
      signature: req.headers.get("x-webhook-signature"),
      secret: process.env.CASHFREE_WEBHOOK_SECRET,
      deps: createWebhookDeps(supabase),
    });

    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (err) {
    console.error("[Cashfree Webhook] Unexpected error:", err);
    // 5xx so the provider retries a delivery we could not process at all.
    return NextResponse.json({ message: "Error processed" }, { status: 500 });
  }
}
