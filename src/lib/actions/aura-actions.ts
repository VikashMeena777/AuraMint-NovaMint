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

  const { description, category, isPublic } = parsed.data;

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

  // Insert event
  const { data: event, error: insertError } = await supabase
    .from("aura_events")
    .insert({
      user_id: user.id,
      description,
      category,
      is_public: isPublic,
      aura_points: auraResult.points,
      ai_verdict: auraResult.verdict,
      ai_vibe_tag: auraResult.vibe_tag,
      ai_emoji: auraResult.emoji,
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
  const newTotalAura = currentAura + auraResult.points;
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
    points: auraResult.points,
    category,
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
    aura: auraResult,
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

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, total_aura, current_tier, streak_days")
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

export async function updateUsername(newUsername: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Must be logged in" };

  // Validate username
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(newUsername)) {
    return { error: "Username must be 3-20 characters, only letters, numbers, and underscores" };
  }

  // Check availability
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", newUsername)
    .neq("id", user.id)
    .single();

  if (existing) {
    return { error: "Username already taken" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ username: newUsername })
    .eq("id", user.id);

  if (error) return { error: "Failed to update username" };

  logActivity(user.id, "profile.username.changed", { new_username: newUsername }).catch(() => {});

  return { success: true };
}
