/**
 * Crash-window repair for paid orders.
 *
 * The payment flow is two non-atomic steps:
 *   1. CAS-claim the order as PAID (the idempotency gate)
 *   2. grant premium entitlements on `profiles`
 *
 * If the process dies between the two (or the grant write fails and the compensating
 * revert also fails), the order is PAID but the user has no premium. On the next
 * delivery the CAS returns `claimed: false`, and treating that as "already processed"
 * loses the entitlement permanently.
 *
 * This module repairs that state at the application level: when a caller observes an
 * order that is already PAID but did not win the claim, it re-reads the entitlement
 * and grants it only when premium is genuinely missing.
 *
 * Granting only-when-missing (instead of re-granting on every duplicate delivery) is
 * also a correctness requirement: `grantPremiumEntitlements` writes
 * `boosts_remaining: PREMIUM_BOOSTS_GRANT`, so an unconditional re-grant on a
 * provider retry would silently replenish a user's already-spent boosts.
 *
 * THIS IS NOT ATOMIC. It narrows the window to "the grant write itself fails", and
 * two concurrent repairs can still both grant — but the grant is value-idempotent
 * (it sets, never increments), so a double grant is harmless. The real fix is a DB
 * transaction/RPC that claims the order and grants entitlements in one statement;
 * that requires verified schema and is recorded as an open blocker in
 * `_audit/backend-final-pass.md`. No such function is assumed or invented here.
 *
 * NOT a "use server" module: a "use server" file turns every export into a publicly
 * callable endpoint, which would expose the grant path.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { grantPremiumEntitlements } from "@/lib/actions/premium";

export type EntitlementSnapshot = {
  /** Whether a `profiles` row exists for the user. */
  found: boolean;
  isPremium: boolean | null;
};

export type RecoveryDecision = "already_entitled" | "needs_grant" | "unverified";

/**
 * Pure decision for an order that is already PAID.
 *
 * - `unverified` — the profile could not be read; the caller must NOT report success.
 * - `already_entitled` — premium is set; nothing to do (and nothing to re-grant).
 * - `needs_grant` — a profile exists but premium is not set; repair it.
 */
export function decidePaidOrderRecovery(
  snapshot: EntitlementSnapshot | null | undefined
): RecoveryDecision {
  if (!snapshot || !snapshot.found) return "unverified";
  return snapshot.isPremium === true ? "already_entitled" : "needs_grant";
}

export type RecoveryResult = { ok: true; recovered: boolean } | { ok: false; error: string };

export type RecoveryDeps = {
  loadEntitlement(
    userId: string
  ): Promise<{ snapshot: EntitlementSnapshot | null; error?: string }>;
  grantPremium(userId: string): Promise<{ ok: boolean; error?: string }>;
  logEvent(userId: string, action: string, metadata: Record<string, unknown>): Promise<void>;
};

/**
 * Reconciles the entitlement for an order already known to be PAID.
 *
 * Returns `ok: false` when the entitlement state cannot be read or the grant fails —
 * callers must surface a transient error so the provider/user retries, never a
 * success it cannot substantiate.
 */
export async function recoverPaidOrderEntitlement(
  deps: RecoveryDeps,
  userId: string,
  orderId: string
): Promise<RecoveryResult> {
  if (typeof userId !== "string" || userId.length === 0) {
    return { ok: false, error: "missing user id" };
  }

  const loaded = await deps.loadEntitlement(userId);
  if (loaded.error) return { ok: false, error: loaded.error };
  if (!loaded.snapshot) return { ok: false, error: "entitlement state unavailable" };

  const decision = decidePaidOrderRecovery(loaded.snapshot);
  if (decision === "unverified") return { ok: false, error: "entitlement state unavailable" };
  if (decision === "already_entitled") return { ok: true, recovered: false };

  const granted = await deps.grantPremium(userId);
  if (!granted.ok) return { ok: false, error: granted.error ?? "grant failed" };

  await deps.logEvent(userId, "payment.entitlement.recovered", { order_id: orderId });
  return { ok: true, recovered: true };
}

/** Supabase binding used by the webhook route and the verify fallback. */
export async function recoverOrderEntitlements(
  supabase: SupabaseClient,
  userId: string,
  orderId: string
): Promise<RecoveryResult> {
  return recoverPaidOrderEntitlement(
    {
      async loadEntitlement(id) {
        const { data, error } = await supabase
          .from("profiles")
          .select("is_premium")
          .eq("id", id)
          .maybeSingle();

        if (error) return { snapshot: null, error: error.message };
        if (!data) return { snapshot: { found: false, isPremium: null } };

        const isPremium = (data as { is_premium?: boolean | null }).is_premium ?? null;
        return { snapshot: { found: true, isPremium } };
      },

      async grantPremium(id) {
        const result = await grantPremiumEntitlements(supabase, id);
        return result.ok ? { ok: true } : { ok: false, error: result.error };
      },

      async logEvent(id, action, metadata) {
        // The audit trail must never be able to break a payment repair.
        try {
          const { error } = await supabase
            .from("activity_log")
            .insert({ user_id: id, action: action.slice(0, 120), metadata });
          if (error) {
            console.error("[payment-repair] Failed to write activity log:", action, error.message);
          }
        } catch (err) {
          console.error("[payment-repair] Failed to write activity log:", action, err);
        }
      },
    },
    userId,
    orderId
  );
}
