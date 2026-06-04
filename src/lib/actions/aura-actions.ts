"use server";

import { createClient } from "@/lib/supabase/server";
import { calculateAura } from "@/lib/ai/aura-calculator";
import { getTierForAura } from "@/lib/ai/prompts";
import { logActivity } from "@/lib/utils/activity-logger";
import { z } from "zod";

const submitEventSchema = z.object({
  description: z.string().min(5, "Describe what happened (at least 5 chars)").max(280, "Keep it under 280 characters"),
  category: z.enum(["crush", "school", "work", "gym", "social", "family", "random"]),
  isPublic: z.boolean().default(true),
  vibeRoll: z.boolean().optional().default(false),
});

export type SubmitEventInput = z.infer<typeof submitEventSchema>;

export async function submitAuraEvent(input: SubmitEventInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to submit an aura event" };
  }

  // Validate input
  const parsed = submitEventSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { description, category, isPublic, vibeRoll } = parsed.data;

  // Check daily limit (5 for free, unlimited for premium)
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium")
    .eq("id", user.id)
    .single();

  if (!(profile as { is_premium: boolean } | null)?.is_premium) {
    const today = new Date().toISOString().split("T")[0];
    const { count } = await supabase
      .from("aura_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", `${today}T00:00:00`);

    if ((count ?? 0) >= 5) {
      return { error: "Daily limit reached! Free users get 5 events/day. Go Premium for unlimited! 👑" };
    }
  }

  // Calculate aura via AI
  const auraResult = await calculateAura(description, category);

  // Check for Comeback Arc: User had a massive loss (< -2500) in the last 24 hours
  let finalPoints = auraResult.points;
  let finalVerdict = auraResult.verdict;
  
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentLosses } = await supabase
    .from("aura_events")
    .select("aura_points")
    .eq("user_id", user.id)
    .lte("aura_points", -2500)
    .gte("created_at", oneDayAgo)
    .limit(1);

  if (recentLosses && recentLosses.length > 0 && auraResult.points > 0) {
    finalPoints = Math.round(auraResult.points * 1.5);
    finalVerdict = `[🏆 COMEBACK ARC ACTIVE — 1.5x Multiplier Applied!] ${finalVerdict}`;
  }

  // Handle the Dopamine "Vibe Roll" Gamble (Double or Nothing)
  let isVibeRollWon = false;
  if (vibeRoll) {
    const roll = Math.random() < 0.5; // 50% chance
    if (roll) {
      finalPoints = finalPoints * 2;
      finalVerdict = `[🔥 VIBE ROLL WON — Double Aura Points Unlocked!] ${finalVerdict}`;
      isVibeRollWon = true;
    } else {
      finalPoints = 0;
      finalVerdict = `[💀 VIBE ROLL LOST — Aura Drained to Zero!] ${finalVerdict}`;
    }
  }

  // Insert event
  const { data: event, error: insertError } = await supabase
    .from("aura_events")
    .insert({
      user_id: user.id,
      description,
      category,
      is_public: isPublic,
      aura_points: finalPoints,
      ai_verdict: finalVerdict,
      ai_vibe_tag: vibeRoll ? (isVibeRollWon ? "VIBE WIN" : "VIBE LOSS") : auraResult.vibe_tag,
      ai_emoji: vibeRoll ? (isVibeRollWon ? "🌟" : "💀") : auraResult.emoji,
    })
    .select()
    .single();

  if (insertError) {
    console.error("[submitAuraEvent]", insertError);
    return { error: "Failed to submit event. Try again." };
  }

  // Update user's total aura + tier
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("total_aura, streak_days, last_active_date")
    .eq("id", user.id)
    .single();

  const currentAura = (currentProfile as { total_aura: number } | null)?.total_aura ?? 0;
  const newTotalAura = currentAura + finalPoints;
  const newTier = getTierForAura(newTotalAura);

  // Calculate streak
  const today = new Date().toISOString().split("T")[0];
  const lastActive = (currentProfile as { last_active_date: string } | null)?.last_active_date;
  const currentStreak = (currentProfile as { streak_days: number } | null)?.streak_days ?? 0;
  let newStreak = currentStreak;

  if (lastActive !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    if (lastActive === yesterdayStr) {
      newStreak = currentStreak + 1;
    } else if (lastActive !== today) {
      newStreak = 1; // Reset streak
    }
  }

  // Streak bonuses
  let streakBonus = 0;
  if (newStreak === 7) streakBonus = 500;
  else if (newStreak === 30) streakBonus = 2000;
  else if (newStreak === 100) streakBonus = 10000;

  await supabase
    .from("profiles")
    .update({
      total_aura: newTotalAura + streakBonus,
      current_tier: newTier.name,
      streak_days: newStreak,
      last_active_date: today,
    })
    .eq("id", user.id);

  // Log activity (fire-and-forget)
  logActivity(user.id, "aura.event.submitted", {
    event_id: (event as { id: string }).id,
    points: finalPoints,
    category,
    vibeRoll,
  }).catch(() => {});

  return {
    success: true,
    event: event as {
      id: string;
      description: string;
      aura_points: number;
      ai_verdict: string;
      ai_vibe_tag: string;
      ai_emoji: string;
      category: string;
      created_at: string;
    },
    aura: {
      points: finalPoints,
      verdict: finalVerdict,
      vibe_tag: vibeRoll ? (isVibeRollWon ? "VIBE WIN" : "VIBE LOSS") : auraResult.vibe_tag,
      emoji: vibeRoll ? (isVibeRollWon ? "🌟" : "💀") : auraResult.emoji,
    },
    newTotalAura: newTotalAura + streakBonus,
    newTier: newTier.name,
    streakBonus,
    streak: newStreak,
  };
}

export async function getPublicFeed(
  tab: "hot" | "fresh" | "top" = "hot",
  page: number = 0,
  limit: number = 20
) {
  const supabase = await createClient();
  const from = page * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("aura_events")
    .select(`
      *,
      profiles!aura_events_user_id_fkey (
        username,
        display_name,
        avatar_url,
        current_tier,
        total_aura
      )
    `)
    .eq("is_public", true);

  switch (tab) {
    case "hot":
      // Most upvoted in last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", oneDayAgo).order("upvotes", { ascending: false });
      break;
    case "fresh":
      query = query.order("created_at", { ascending: false });
      break;
    case "top":
      query = query.order("upvotes", { ascending: false });
      break;
  }

  const { data, error } = await query.range(from, to);

  if (error) {
    console.error("[getPublicFeed]", error);
    return { events: [], hasMore: false };
  }

  return {
    events: data || [],
    hasMore: (data?.length ?? 0) === limit,
  };
}

export async function voteOnEvent(eventId: string, value: 1 | -1) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Must be logged in" };

  // Check existing vote
  const { data: existing } = await supabase
    .from("votes")
    .select("id, value")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    const existingVote = existing as { id: string; value: number };
    if (existingVote.value === value) {
      // Remove vote (toggle off)
      await supabase.from("votes").delete().eq("id", existingVote.id);
      // Update event count
      const column = value === 1 ? "upvotes" : "downvotes";
      await supabase.rpc("decrement_column", { table_name: "aura_events", column_name: column, row_id: eventId });
      return { success: true, action: "removed" };
    } else {
      // Switch vote
      await supabase.from("votes").update({ value }).eq("id", existingVote.id);
      // Adjust counts
      if (value === 1) {
        await supabase.from("aura_events").update({}).eq("id", eventId); // will handle via direct update
      }
      return { success: true, action: "switched" };
    }
  }

  // New vote
  const { error } = await supabase.from("votes").insert({
    event_id: eventId,
    user_id: user.id,
    value,
  });

  if (error) return { error: "Failed to vote" };

  return { success: true, action: "voted" };
}

export async function reactToEvent(eventId: string, type: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Must be logged in" };

  // Check existing reaction
  const { data: existing } = await supabase
    .from("reactions")
    .select("id, type")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    const existingReaction = existing as { id: string; type: string };
    if (existingReaction.type === type) {
      // Remove reaction (toggle off)
      await supabase.from("reactions").delete().eq("id", existingReaction.id);
      return { success: true, action: "removed" };
    } else {
      // Switch reaction
      await supabase.from("reactions").update({ type }).eq("id", existingReaction.id);
      return { success: true, action: "switched" };
    }
  }

  // New reaction
  const { error } = await supabase.from("reactions").insert({
    event_id: eventId,
    user_id: user.id,
    type,
  });

  if (error) return { error: "Failed to react" };

  return { success: true, action: "reacted" };
}

export async function getLeaderboard(
  period: "daily" | "weekly" | "alltime" = "alltime",
  page: number = 0,
  limit: number = 50
) {
  const supabase = await createClient();
  const from = page * limit;
  const to = from + limit - 1;

  if (period === "alltime") {
    // All-time: just read total_aura from profiles
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, total_aura, current_tier, streak_days, is_premium")
      .order("total_aura", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("[getLeaderboard]", error);
      return { users: [], hasMore: false };
    }

    return {
      users: (data || []).map((user, index) => ({
        ...user,
        rank: from + index + 1,
      })),
      hasMore: (data?.length ?? 0) === limit,
    };
  }

  // Daily/Weekly: aggregate aura_points from events within the period
  const now = new Date();
  let since: Date;

  if (period === "daily") {
    since = new Date(now);
    since.setHours(0, 0, 0, 0);
  } else {
    // Weekly: last 7 days
    since = new Date(now);
    since.setDate(since.getDate() - 7);
    since.setHours(0, 0, 0, 0);
  }

  // Get events in the period grouped by user
  const { data: events, error } = await supabase
    .from("aura_events")
    .select("user_id, aura_points")
    .gte("created_at", since.toISOString());

  if (error) {
    console.error("[getLeaderboard]", error);
    return { users: [], hasMore: false };
  }

  // Aggregate by user
  const userAuraMap = new Map<string, number>();
  for (const event of events || []) {
    const uid = (event as any).user_id;
    const pts = (event as any).aura_points || 0;
    userAuraMap.set(uid, (userAuraMap.get(uid) || 0) + pts);
  }

  // Sort by aura descending
  const sorted = [...userAuraMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(from, to + 1);

  if (sorted.length === 0) {
    return { users: [], hasMore: false };
  }

  // Fetch profiles for these users
  const userIds = sorted.map(([uid]) => uid);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, current_tier, streak_days, is_premium")
    .in("id", userIds);

  const profileMap = new Map((profiles || []).map(p => [(p as any).id, p]));

  return {
    users: sorted.map(([uid, periodAura], index) => {
      const profile = profileMap.get(uid) || {};
      return {
        ...(profile as any),
        total_aura: periodAura,
        rank: from + index + 1,
      };
    }),
    hasMore: sorted.length === limit,
  };
}

export async function getUserProfile(username: string) {
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();

  if (error || !profile) {
    return { error: "User not found" };
  }

  // Get recent events
  const { data: events } = await supabase
    .from("aura_events")
    .select("*")
    .eq("user_id", (profile as { id: string }).id)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(20);

  // Get aura history (last 30 days aggregate)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: history } = await supabase
    .from("aura_events")
    .select("aura_points, created_at")
    .eq("user_id", (profile as { id: string }).id)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: true });

  return {
    profile,
    events: events || [],
    history: history || [],
  };
}

export async function updateProfile(newUsername: string, newDisplayName: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Must be logged in" };

  // Validate username
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(newUsername)) {
    return { error: "Username must be 3-20 characters, only letters, numbers, and underscores" };
  }

  // Get current profile
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("username, username_changes, display_name")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile) {
    return { error: "Profile not found" };
  }

  const isUsernameChanging = profile.username !== newUsername;
  let updatedChanges = (profile as any).username_changes || [];

  if (isUsernameChanging) {
    // Check uniqueness of new username
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", newUsername)
      .neq("id", user.id)
      .maybeSingle();

    if (existing) {
      return { error: "Username already taken" };
    }

    // Check frequency of username change: twice a 15 days
    const now = new Date();
    const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

    // Filter changes to last 15 days
    const recentChanges = updatedChanges.filter((changeStr: string) => {
      const changeDate = new Date(changeStr);
      return changeDate >= fifteenDaysAgo;
    });

    if (recentChanges.length >= 2) {
      return { error: "You can only change your username twice every 15 days." };
    }

    // Append new change timestamp
    updatedChanges = [...recentChanges, now.toISOString()];
  }

  // Perform database update
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({
      username: newUsername,
      display_name: newDisplayName.trim(),
      username_changes: updatedChanges,
    })
    .eq("id", user.id);

  if (updateErr) {
    return { error: "Failed to update profile details" };
  }

  if (isUsernameChanging) {
    logActivity(user.id, "profile.username.changed", { new_username: newUsername }).catch(() => {});
  }

  return { success: true };
}

export async function updateUsername(newUsername: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Must be logged in" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const currentDisplayName = profile?.display_name || "";
  return await updateProfile(newUsername, currentDisplayName);
}

// ─── Boost an Event (Premium Feature) ───
export async function boostEvent(eventId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Must be logged in" };

  // Verify premium + has boosts
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium, boosts_remaining")
    .eq("id", user.id)
    .single();

  if (!profile || !(profile as any).is_premium) {
    return { error: "Boost is a Premium feature. Upgrade to unlock!" };
  }

  const boostsLeft = (profile as any).boosts_remaining || 0;
  if (boostsLeft <= 0) {
    return { error: "No boosts remaining this month. Resets on the 1st!" };
  }

  // Verify event belongs to user
  const { data: event } = await supabase
    .from("aura_events")
    .select("id, user_id, is_boosted")
    .eq("id", eventId)
    .single();

  if (!event || (event as any).user_id !== user.id) {
    return { error: "You can only boost your own events" };
  }

  if ((event as any).is_boosted) {
    return { error: "This event is already boosted! 🚀" };
  }

  // Apply the boost
  const { error: boostErr } = await supabase
    .from("aura_events")
    .update({ is_boosted: true, boosted_at: new Date().toISOString() })
    .eq("id", eventId);

  if (boostErr) return { error: "Failed to boost event" };

  // Deduct a boost
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({ boosts_remaining: boostsLeft - 1 })
    .eq("id", user.id);

  if (profileErr) return { error: "Failed to update boost count" };

  logActivity(user.id, "event.boosted", { event_id: eventId }).catch(() => {});

  return { success: true, boostsRemaining: boostsLeft - 1 };
}

// ─── Analytics Data (Premium Feature) ───
export async function getAnalyticsData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Must be logged in" };

  // Fetch all user events (max 500 for perf)
  const { data: events, error } = await supabase
    .from("aura_events")
    .select("aura_points, category, created_at, ai_vibe_tag, description, upvotes, is_boosted")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) return { error: "Failed to load analytics" };
  if (!events || events.length === 0) return { events: [], isEmpty: true };

  // Fetch profile for context
  const { data: profile } = await supabase
    .from("profiles")
    .select("total_aura, current_tier, streak_days, is_premium, boosts_remaining, created_at")
    .eq("id", user.id)
    .single();

  // ── Daily Trend (last 30 days) ──
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dailyMap = new Map<string, { gain: number; loss: number; count: number }>();

  for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split("T")[0];
    dailyMap.set(key, { gain: 0, loss: 0, count: 0 });
  }

  const typedEvents = events as { aura_points: number; category: string; created_at: string; ai_vibe_tag: string; description: string; upvotes: number; is_boosted: boolean }[];

  for (const e of typedEvents) {
    const day = new Date(e.created_at).toISOString().split("T")[0];
    const entry = dailyMap.get(day);
    if (entry) {
      if (e.aura_points >= 0) entry.gain += e.aura_points;
      else entry.loss += Math.abs(e.aura_points);
      entry.count++;
    }
  }

  const dailyTrend = Array.from(dailyMap.entries()).map(([date, data]) => ({
    date,
    label: new Date(date).toLocaleDateString("en", { month: "short", day: "numeric" }),
    gain: data.gain,
    loss: data.loss,
    net: data.gain - data.loss,
    count: data.count,
  }));

  // ── Category Breakdown ──
  const categoryMap = new Map<string, { total: number; count: number; wins: number; losses: number }>();
  for (const e of typedEvents) {
    const cat = e.category || "random";
    const entry = categoryMap.get(cat) || { total: 0, count: 0, wins: 0, losses: 0 };
    entry.total += e.aura_points;
    entry.count++;
    if (e.aura_points >= 0) entry.wins++; else entry.losses++;
    categoryMap.set(cat, entry);
  }

  const categoryBreakdown = Array.from(categoryMap.entries()).map(([cat, data]) => ({
    category: cat,
    total: data.total,
    count: data.count,
    wins: data.wins,
    losses: data.losses,
    avgPoints: Math.round(data.total / data.count),
  })).sort((a, b) => b.count - a.count);

  // ── Win/Loss Stats ──
  const wins = typedEvents.filter(e => e.aura_points >= 0);
  const losses = typedEvents.filter(e => e.aura_points < 0);
  const totalGain = wins.reduce((s, e) => s + e.aura_points, 0);
  const totalLoss = losses.reduce((s, e) => s + Math.abs(e.aura_points), 0);

  // ── Top Events ──
  const sortedByPoints = [...typedEvents].sort((a, b) => Math.abs(b.aura_points) - Math.abs(a.aura_points));
  const topWin = sortedByPoints.find(e => e.aura_points > 0);
  const topLoss = sortedByPoints.find(e => e.aura_points < 0);
  const mostVoted = [...typedEvents].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0))[0];

  // ── Vibe Tags Distribution ──
  const vibeMap = new Map<string, number>();
  for (const e of typedEvents) {
    if (e.ai_vibe_tag) {
      vibeMap.set(e.ai_vibe_tag, (vibeMap.get(e.ai_vibe_tag) || 0) + 1);
    }
  }
  const vibeDistribution = Array.from(vibeMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // ── Boosted Events Count ──
  const boostedCount = typedEvents.filter(e => e.is_boosted).length;

  return {
    profile: profile as any,
    stats: {
      totalEvents: typedEvents.length,
      totalWins: wins.length,
      totalLosses: losses.length,
      totalGain,
      totalLoss,
      netAura: totalGain - totalLoss,
      winRate: Math.round((wins.length / typedEvents.length) * 100),
      avgPoints: Math.round((totalGain - totalLoss) / typedEvents.length),
      boostedCount,
    },
    dailyTrend,
    categoryBreakdown,
    vibeDistribution,
    highlights: {
      topWin: topWin ? { description: topWin.description, points: topWin.aura_points } : null,
      topLoss: topLoss ? { description: topLoss.description, points: topLoss.aura_points } : null,
      mostVoted: mostVoted ? { description: mostVoted.description, upvotes: mostVoted.upvotes } : null,
    },
  };
}
