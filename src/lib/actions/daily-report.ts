"use server";

import { createClient } from "@/lib/supabase/server";
import { sanitizePlainText, truncateCodePoints } from "@/lib/actions/safety";

export type DailyReport = {
  date: string;
  totalEvents: number;
  totalAuraGained: number;
  biggestW: { description: string; points: number; emoji: string } | null;
  biggestL: { description: string; points: number; emoji: string } | null;
  vibeOfTheDay: string;
  streakDays: number;
};

type ReportEvent = {
  description: string | null;
  aura_points: number | null;
  ai_emoji: string | null;
  ai_vibe_tag: string | null;
};

export async function getDailyReport(): Promise<DailyReport | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const today = new Date().toISOString().split("T")[0];

  const { data: events, error: eventsError } = await supabase
    .from("aura_events")
    .select("description, aura_points, ai_emoji, ai_vibe_tag")
    .eq("user_id", user.id)
    .gte("created_at", `${today}T00:00:00`)
    .order("aura_points", { ascending: false });

  if (eventsError) {
    console.error("[getDailyReport] Query failed:", eventsError.message);
    return null;
  }

  if (!events || events.length === 0) return null;

  const typedEvents = events as ReportEvent[];
  const scored = typedEvents.map((e) => ({
    description: sanitizePlainText(e.description, 280),
    points: Number(e.aura_points) || 0,
    emoji: truncateCodePoints(e.ai_emoji, 4) || "✨",
    vibeTag: sanitizePlainText(e.ai_vibe_tag, 40),
  }));

  const totalAuraGained = scored.reduce((sum, e) => sum + e.points, 0);
  const sorted = [...scored].sort((a, b) => b.points - a.points);

  const topEvent = sorted[0];
  const bottomEvent = sorted[sorted.length - 1];

  const biggestW = topEvent && topEvent.points > 0
    ? { description: topEvent.description, points: topEvent.points, emoji: topEvent.emoji }
    : null;

  const biggestL = bottomEvent && bottomEvent.points < 0
    ? { description: bottomEvent.description, points: bottomEvent.points, emoji: bottomEvent.emoji }
    : null;

  // Most common vibe tag
  const vibeFreq = new Map<string, number>();
  for (const e of scored) {
    if (e.vibeTag) vibeFreq.set(e.vibeTag, (vibeFreq.get(e.vibeTag) ?? 0) + 1);
  }
  const vibeOfTheDay =
    [...vibeFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Chill";

  const { data: profile } = await supabase
    .from("profiles")
    .select("streak_days")
    .eq("id", user.id)
    .maybeSingle();

  return {
    date: today,
    totalEvents: scored.length,
    totalAuraGained,
    biggestW,
    biggestL,
    vibeOfTheDay,
    streakDays: (profile as { streak_days?: number | null } | null)?.streak_days ?? 0,
  };
}
