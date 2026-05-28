"use server";

import { createClient } from "@/lib/supabase/server";
import { formatAuraPoints } from "@/lib/utils";

export type DailyReport = {
  date: string;
  totalEvents: number;
  totalAuraGained: number;
  biggestW: { description: string; points: number; emoji: string } | null;
  biggestL: { description: string; points: number; emoji: string } | null;
  vibeOfTheDay: string;
  streakDays: number;
};

export async function getDailyReport(): Promise<DailyReport | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const today = new Date().toISOString().split("T")[0];

  const { data: events } = await supabase
    .from("aura_events")
    .select("description, aura_points, ai_emoji, ai_vibe_tag")
    .eq("user_id", user.id)
    .gte("created_at", `${today}T00:00:00`)
    .order("aura_points", { ascending: false });

  if (!events || events.length === 0) return null;

  const totalAuraGained = events.reduce((sum: number, e: any) => sum + e.aura_points, 0);
  const sorted = [...events].sort((a: any, b: any) => b.aura_points - a.aura_points);

  const biggestW = sorted[0] && (sorted[0] as any).aura_points > 0
    ? { description: (sorted[0] as any).description, points: (sorted[0] as any).aura_points, emoji: (sorted[0] as any).ai_emoji }
    : null;

  const biggestL = sorted[sorted.length - 1] && (sorted[sorted.length - 1] as any).aura_points < 0
    ? { description: (sorted[sorted.length - 1] as any).description, points: (sorted[sorted.length - 1] as any).aura_points, emoji: (sorted[sorted.length - 1] as any).ai_emoji }
    : null;

  // Most common vibe tag
  const vibeFreq: Record<string, number> = {};
  events.forEach((e: any) => {
    if (e.ai_vibe_tag) vibeFreq[e.ai_vibe_tag] = (vibeFreq[e.ai_vibe_tag] || 0) + 1;
  });
  const vibeOfTheDay = Object.entries(vibeFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || "Chill";

  const { data: profile } = await supabase
    .from("profiles")
    .select("streak_days")
    .eq("id", user.id)
    .single();

  return {
    date: today,
    totalEvents: events.length,
    totalAuraGained,
    biggestW,
    biggestL,
    vibeOfTheDay,
    streakDays: (profile as any)?.streak_days ?? 0,
  };
}
