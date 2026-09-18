"use server";

import { createClient } from "@/lib/supabase/server";
import { FREE_DAILY_EVENT_LIMIT, UNLIMITED_DAILY_EVENTS } from "@/lib/actions/plan-constants";

export type PlanLimits = {
  isPremium: boolean;
  /** `null` means unlimited (premium). */
  dailyEventsLimit: number | null;
  dailyEventsUsed: number;
  canSubmit: boolean;
  aiQuality: "standard" | "savage";
  hasAds: boolean;
  shareWatermark: boolean;
};

/**
 * Check the current user's plan limits.
 * Returns plan status, usage counts, and feature flags.
 */
export async function getUserPlanLimits(): Promise<PlanLimits> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      isPremium: false,
      dailyEventsLimit: FREE_DAILY_EVENT_LIMIT,
      dailyEventsUsed: 0,
      canSubmit: false,
      aiQuality: "standard",
      hasAds: true,
      shareWatermark: true,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium")
    .eq("id", user.id)
    .maybeSingle();

  const isPremium = (profile as { is_premium?: boolean | null } | null)?.is_premium ?? false;

  // Count today's events (UTC day boundary, matching the submit action).
  const today = new Date().toISOString().split("T")[0];
  const { count, error: countError } = await supabase
    .from("aura_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", `${today}T00:00:00`);

  if (countError) {
    console.error("[getUserPlanLimits] Count failed:", countError.message);
  }

  const dailyEventsUsed = count ?? 0;

  return {
    isPremium,
    dailyEventsLimit: isPremium ? UNLIMITED_DAILY_EVENTS : FREE_DAILY_EVENT_LIMIT,
    dailyEventsUsed,
    canSubmit: isPremium || dailyEventsUsed < FREE_DAILY_EVENT_LIMIT,
    aiQuality: isPremium ? "savage" : "standard",
    hasAds: !isPremium,
    shareWatermark: !isPremium,
  };
}
