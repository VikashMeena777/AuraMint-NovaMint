"use server";

import { createClient } from "@/lib/supabase/server";

export type PlanLimits = {
  isPremium: boolean;
  dailyEventsLimit: number;
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
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      isPremium: false,
      dailyEventsLimit: 5,
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
    .single();

  const isPremium = (profile as { is_premium: boolean } | null)?.is_premium ?? false;

  // Count today's events
  const today = new Date().toISOString().split("T")[0];
  const { count } = await supabase
    .from("aura_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", `${today}T00:00:00`);

  const dailyEventsUsed = count ?? 0;
  const dailyEventsLimit = isPremium ? Infinity : 5;
  const canSubmit = isPremium || dailyEventsUsed < 5;

  return {
    isPremium,
    dailyEventsLimit,
    dailyEventsUsed,
    canSubmit,
    aiQuality: isPremium ? "savage" : "standard",
    hasAds: !isPremium,
    shareWatermark: !isPremium,
  };
}
