/**
 * Premium plan constants and entitlement helpers shared by the Cashfree webhook,
 * the payment verification action, and the order-creation action.
 *
 * IMPORTANT: this module has no "use server" directive on purpose. A "use server"
 * file turns every export into a publicly callable Server Action, which would make
 * `grantPremiumEntitlements(userId)` a privilege-escalation endpoint. Callers are
 * responsible for proving the order belongs to the user before granting.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** ₹99 in paise — `orders.amount` is stored in minor units. */
export const PLAN_PRICE_PAISE = 9900;
export const PLAN_CURRENCY = "INR";
/** Boosts granted on every successful upgrade (matches the previous verify behaviour). */
export const PREMIUM_BOOSTS_GRANT = 5;

export type DbResult = { ok: true } | { ok: false; error: string };

/**
 * Grants premium entitlements to a user identified by a *server-verified* id.
 * Idempotent: safe to call again for the same purchase.
 *
 * An UPDATE matching zero rows is NOT an error for PostgREST, so the affected rows are
 * checked explicitly. Before this check, a grant against a missing (or RLS-hidden)
 * profile returned `{ ok: true }`: the caller claimed the order PAID, reported success
 * and the paying user never received premium. Zero rows now fails the grant so callers
 * revert the claim / return an error instead of claiming an unsubstantiated success.
 */
export async function grantPremiumEntitlements(
  supabase: SupabaseClient,
  userId: string
): Promise<DbResult> {
  if (typeof userId !== "string" || userId.length === 0) {
    return { ok: false, error: "grantPremiumEntitlements: missing user id" };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ is_premium: true, boosts_remaining: PREMIUM_BOOSTS_GRANT })
    .eq("id", userId)
    .select("id");

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, error: "grantPremiumEntitlements: profile not found" };
  }

  return { ok: true };
}

/**
 * Atomically claims an order as PAID.
 *
 * The conditional `status != PAID` filter is what makes this idempotent under
 * concurrent webhook deliveries: exactly one caller can observe `claimed: true`.
 *
 * Pass `ownerId` whenever the caller is acting on behalf of a user session — the
 * extra `user_id` filter makes the claim unable to touch another user's order.
 */
export async function claimOrderAsPaid(
  supabase: SupabaseClient,
  orderId: string,
  ownerId?: string
): Promise<{ ok: true; claimed: boolean } | { ok: false; error: string }> {
  let query = supabase
    .from("orders")
    .update({ status: "PAID" })
    .eq("id", orderId)
    .neq("status", "PAID");

  if (ownerId) {
    query = query.eq("user_id", ownerId);
  }

  const { data, error } = await query.select("id");

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, claimed: Array.isArray(data) && data.length > 0 };
}

/** Never downgrades PAID or rewrites FAILED; zero rows does not identify the reason. */
export async function markOrderFailed(
  supabase: SupabaseClient,
  orderId: string
): Promise<DbResult & { updated: boolean }> {
  const { data, error } = await supabase
    .from("orders")
    .update({ status: "FAILED" })
    .eq("cashfree_order_id", orderId)
    .eq("status", "PENDING")
    .select("id");

  if (error) return { ok: false, error: error.message, updated: false };
  return { ok: true, updated: Array.isArray(data) && data.length > 0 };
}

/**
 * Appends an entry to the audit trail. Never throws — the audit log must not be
 * able to break a payment path.
 */
export async function logPaymentEvent(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const { error } = await supabase.from("activity_log").insert({
      user_id: userId,
      action: action.slice(0, 120),
      metadata,
    });
    if (error) {
      console.error("[PaymentAudit] Failed to write activity log:", action, error.message);
    }
  } catch (err) {
    console.error("[PaymentAudit] Failed to write activity log:", action, err);
  }
}
