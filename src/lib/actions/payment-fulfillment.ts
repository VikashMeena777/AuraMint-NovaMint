import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidOrderId } from "./safety";
import { PLAN_CURRENCY, PLAN_PRICE_PAISE } from "./premium";

export type FulfillmentResult =
  | { ok: true; applied: boolean; recovered: boolean }
  | { ok: false; error: string };

/** Call only after signature/provider verification and owner resolution, using a service client. */
export async function fulfillPremiumOrder(
  supabase: SupabaseClient,
  orderId: string,
  userId: string
): Promise<FulfillmentResult> {
  if (!isValidOrderId(orderId) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return { ok: false, error: "Invalid fulfillment identity" };
  }
  try {
    const { data, error } = await supabase.rpc("fulfill_premium_order", {
      p_order_id: orderId,
      p_user_id: userId,
      p_amount_minor: PLAN_PRICE_PAISE,
      p_currency: PLAN_CURRENCY,
    });
    if (error) return { ok: false, error: error.message };
    if (!data || typeof data.applied !== "boolean" || typeof data.recovered !== "boolean") {
      return { ok: false, error: "Unverified fulfillment result" };
    }
    return { ok: true, applied: data.applied, recovered: data.recovered };
  } catch {
    return { ok: false, error: "Fulfillment unavailable" };
  }
}

export async function reconcilePremiumEntitlements(supabase: SupabaseClient): Promise<
  | { ok: true; attempted: number; repaired: number; failed: number }
  | { ok: false; error: string }
> {
  try {
    const { data, error } = await supabase.rpc("reconcile_premium_entitlements", { p_limit: 100 });
    if (error) return { ok: false, error: error.message };
    const counts: unknown[] = data ? [data.attempted, data.repaired, data.failed] : [];
    if (counts.length !== 3 || !counts.every((value) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 100)
      || data.repaired + data.failed > data.attempted) {
      return { ok: false, error: "Unverified reconciliation result" };
    }
    return { ok: true, attempted: data.attempted, repaired: data.repaired, failed: data.failed };
  } catch {
    return { ok: false, error: "Reconciliation unavailable" };
  }
}
