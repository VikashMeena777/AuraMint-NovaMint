"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { calculateAura } from "@/lib/ai/aura-calculator";
import { getTierForAura } from "@/lib/ai/prompts";
import { logActivity } from "@/lib/utils/activity-logger";
import { FREE_DAILY_EVENT_LIMIT } from "@/lib/actions/plan-constants";
import {
  aggregateReactionCounts,
  indexViewerReactions,
  indexViewerVotes,
} from "@/lib/actions/feed-aggregates";
import { consumeRateLimit, rateLimitUserMessage, RATE_LIMITS } from "@/lib/rate-limit";
import {
  boundedInt,
  isReactionType,
  isSafeId,
  isVoteValue,
  sanitizePlainText,
  truncateCodePoints,
  type ReactionType,
  type VoteValue,
} from "@/lib/actions/safety";

// ─────────────────────────────────────────────────────────────
// Constants & schemas
// ─────────────────────────────────────────────────────────────

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
const DISPLAY_NAME_MAX = 50;

const CATEGORY_VALUES = ["crush", "school", "work", "gym", "social", "family", "random"] as const;

const submitEventSchema = z.object({
  description: z
    .string()
    .min(5, "Describe what happened (at least 5 chars)")
    .max(280, "Keep it under 280 characters"),
  category: z.enum(CATEGORY_VALUES),
  isPublic: z.boolean().default(true),
  vibeRoll: z.boolean().optional().default(false),
});

const usernameSchema = z
  .string()
  .trim()
  .regex(USERNAME_PATTERN, "Username must be 3-20 characters, only letters, numbers, and underscores");

const displayNameSchema = z
  .string()
  .max(200, "Display name is too long")
  .transform((value) => sanitizePlainText(value, DISPLAY_NAME_MAX));

export type SubmitEventInput = z.infer<typeof submitEventSchema>;

// ─────────────────────────────────────────────────────────────
// Row types (schema-agnostic, nullable Supabase columns)
// ─────────────────────────────────────────────────────────────

/**
 * Row types as returned by the actions.
 *
 * Fields the presentation layer requires to be non-null (`aura_points`, `description`,
 * `created_at`, ids) are normalised at the query boundary by `normalizeEventRow`, so a
 * legacy null column can never leak `null` into a component.
 */

export type AuraEventRow = {
  id: string;
  user_id: string;
  description: string;
  category: string | null;
  is_public: boolean | null;
  aura_points: number;
  ai_verdict: string | null;
  ai_vibe_tag: string | null;
  ai_emoji: string | null;
  upvotes: number | null;
  downvotes: number | null;
  is_boosted: boolean | null;
  created_at: string;
};

type RawEventRow = Partial<Record<keyof AuraEventRow, unknown>>;

/** Coalesces nullable database columns into the non-null contract the UI expects. */
function normalizeEventRow(row: RawEventRow | null | undefined): AuraEventRow | null {
  if (!row || typeof row !== "object") return null;

  const id = typeof row.id === "string" ? row.id : "";
  if (!id) return null;

  return {
    id,
    user_id: typeof row.user_id === "string" ? row.user_id : "",
    description: typeof row.description === "string" ? row.description : "",
    category: typeof row.category === "string" ? row.category : null,
    is_public: typeof row.is_public === "boolean" ? row.is_public : null,
    aura_points: Number.isFinite(Number(row.aura_points)) ? Number(row.aura_points) : 0,
    ai_verdict: typeof row.ai_verdict === "string" ? row.ai_verdict : null,
    ai_vibe_tag: typeof row.ai_vibe_tag === "string" ? row.ai_vibe_tag : null,
    ai_emoji: typeof row.ai_emoji === "string" ? row.ai_emoji : null,
    upvotes: Number.isFinite(Number(row.upvotes)) ? Number(row.upvotes) : 0,
    downvotes: Number.isFinite(Number(row.downvotes)) ? Number(row.downvotes) : 0,
    is_boosted: typeof row.is_boosted === "boolean" ? row.is_boosted : null,
    created_at:
      typeof row.created_at === "string" && row.created_at.length > 0
        ? row.created_at
        : new Date(0).toISOString(),
  };
}

function normalizeEventRows(rows: unknown): AuraEventRow[] {
  if (!Array.isArray(rows)) return [];
  const out: AuraEventRow[] = [];
  for (const row of rows) {
    const normalized = normalizeEventRow(row as RawEventRow);
    if (normalized) out.push(normalized);
  }
  return out;
}

function normalizePublicProfile(
  row: Partial<Record<keyof PublicProfileSummary, unknown>> | null | undefined
): PublicProfileSummary | null {
  if (!row || typeof row !== "object") return null;
  return {
    username: typeof row.username === "string" ? row.username : null,
    display_name: typeof row.display_name === "string" ? row.display_name : null,
    avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : null,
    current_tier: typeof row.current_tier === "string" ? row.current_tier : null,
    total_aura: Number.isFinite(Number(row.total_aura)) ? Number(row.total_aura) : null,
    is_premium: typeof row.is_premium === "boolean" ? row.is_premium : null,
  };
}

export type PublicProfileSummary = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  current_tier: string | null;
  total_aura: number | null;
  is_premium: boolean | null;
};

/**
 * A feed row plus the read-side state the UI needs:
 * - `reaction_counts` is aggregated from the `reactions` table (no maintained column);
 * - `viewer_vote` / `viewer_reaction` are the *current viewer's* rows, so the card can
 *   render the pressed state and can re-render correctly after a refresh.
 */
export type PublicFeedEvent = AuraEventRow & {
  profiles: PublicProfileSummary | null;
  reaction_counts: Record<string, number>;
  viewer_vote: VoteValue | null;
  viewer_reaction: ReactionType | null;
};

export type LeaderboardUser = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  total_aura: number;
  current_tier: string | null;
  streak_days: number | null;
  is_premium: boolean | null;
  rank: number;
};

export type SubmitAuraEventResult =
  | {
      error: string;
      success?: undefined;
      event?: undefined;
      aura?: undefined;
      newTotalAura?: undefined;
      newTier?: undefined;
      streakBonus?: undefined;
      streak?: undefined;
    }
  | {
      error?: undefined;
      success: true;
      event: {
        id: string;
        description: string;
        aura_points: number;
        ai_verdict: string;
        ai_vibe_tag: string;
        ai_emoji: string;
        category: string;
        created_at: string;
      };
      aura: {
        points: number;
        verdict: string;
        vibe_tag: string;
        emoji: string;
      };
      newTotalAura: number;
      newTier: string;
      streakBonus: number;
      streak: number;
    };

export type VoteResult = {
  error?: string;
  success?: boolean;
  action?: "voted" | "removed" | "switched";
};

export type ReactionResult = {
  error?: string;
  success?: boolean;
  action?: "reacted" | "removed" | "switched";
};

export type BoostResult = {
  error?: string;
  success?: boolean;
  boostsRemaining?: number;
};

export type PublicFeedResult = {
  events: PublicFeedEvent[];
  hasMore: boolean;
  /**
   * Present only when the feed query itself failed, so the UI can tell "no entries"
   * apart from "couldn't load". Aggregate failures never set this (they degrade to
   * empty counts on otherwise valid rows).
   */
  error?: string;
};
export type LeaderboardResult = { users: LeaderboardUser[]; hasMore: boolean };

/** Public profile payload (username is non-null: it is the lookup key). */
export type UserProfileRecord = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  current_tier: string | null;
  total_aura: number | null;
  streak_days: number | null;
  created_at: string | null;
};

export type AuraHistoryPoint = { aura_points: number; created_at: string };

export type UserProfileResult =
  | { error: string; profile?: undefined; events?: undefined; history?: undefined }
  | {
      error?: undefined;
      profile: UserProfileRecord;
      events: AuraEventRow[];
      history: AuraHistoryPoint[];
    };

// ─────────────────────────────────────────────────────────────
// Profile summary
// ─────────────────────────────────────────────────────────────

type ProfileRow = {
  is_premium?: boolean | null;
  total_aura?: number | null;
  streak_days?: number | null;
  boosts_remaining?: number | null;
  last_active_date?: string | null;
  username?: string | null;
  display_name?: string | null;
  username_changes?: unknown;
};

async function getOwnProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<{ profile: ProfileRow | null; error?: string }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) return { profile: null, error: error.message };
  return { profile: (data as ProfileRow | null) ?? null };
}

// ─────────────────────────────────────────────────────────────
// Submit an aura event
// ─────────────────────────────────────────────────────────────

export async function submitAuraEvent(input: SubmitEventInput): Promise<SubmitAuraEventResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to submit an aura event" };
  }

  // Validate input (Server Actions are reachable by direct POST — never trust the shape)
  const parsed = submitEventSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { description, category, isPublic, vibeRoll } = parsed.data;

  // Vertical abuse guard: the AI call below is the only user-triggered model spend.
  // Placed after input validation (malformed requests cost nothing) and before any
  // expensive work, so it also caps DB load. Fails closed in production.
  const rate = await consumeRateLimit({
    scope: "ai.submit_event",
    subject: user.id,
    ...RATE_LIMITS.submitEvent,
  });
  if (!rate.allowed) {
    return { error: rateLimitUserMessage(rate) };
  }

  const { profile, error: profileError } = await getOwnProfile(supabase, user.id);
  if (profileError || !profile) {
    return { error: "Failed to submit event. Try again." };
  }

  // Check daily limit (5 for free, unlimited for premium).
  // NOTE: read-then-insert is not atomic; the atomic fix needs a DB function/trigger
  // (see _audit/backend-report.md — schema requirements).
  if (!profile.is_premium) {
    const today = new Date().toISOString().split("T")[0];
    const { count } = await supabase
      .from("aura_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", `${today}T00:00:00`);

    if ((count ?? 0) >= FREE_DAILY_EVENT_LIMIT) {
      return { error: "Daily limit reached! Free users get 5 events/day. Go Premium for unlimited! 👑" };
    }
  }

  // Calculate aura via AI (falls back to the rules engine; output is coerced/clamped there)
  const auraResult = await calculateAura(description, category);

  // Comeback Arc: a massive loss (< -2500) in the last 24h multiplies the next win
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

  // Vibe Roll gamble (double or nothing)
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

  const vibeTag = vibeRoll ? (isVibeRollWon ? "VIBE WIN" : "VIBE LOSS") : auraResult.vibe_tag;
  const emoji = vibeRoll ? (isVibeRollWon ? "🌟" : "💀") : auraResult.emoji;

  // Insert event
  const { data: event, error: insertError } = await supabase
    .from("aura_events")
    .insert({
      user_id: user.id,
      description: sanitizePlainText(description, 280),
      category,
      is_public: isPublic,
      aura_points: finalPoints,
      ai_verdict: finalVerdict,
      ai_vibe_tag: vibeTag,
      ai_emoji: emoji,
    })
    .select("*")
    .single();

  if (insertError || !event) {
    console.error("[submitAuraEvent] Insert failed:", insertError?.message);
    return { error: "Failed to submit event. Try again." };
  }

  const insertedEvent = normalizeEventRow(event as RawEventRow);
  const eventId = insertedEvent?.id ?? "";
  if (!insertedEvent || !eventId) {
    console.error("[submitAuraEvent] Insert returned no usable row");
    return { error: "Failed to submit event. Try again." };
  }

  // Update total aura + tier + streak
  const currentAura = profile.total_aura ?? 0;
  const currentStreak = profile.streak_days ?? 0;
  const lastActive = profile.last_active_date ?? null;

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  let newStreak = currentStreak;
  if (lastActive !== today) {
    newStreak = lastActive === yesterdayStr ? currentStreak + 1 : 1;
  }

  let streakBonus = 0;
  if (newStreak === 7) streakBonus = 500;
  else if (newStreak === 30) streakBonus = 2000;
  else if (newStreak === 100) streakBonus = 10000;

  // NOTE: read-modify-write on total_aura/streak_days can lose concurrent updates;
  // the atomic fix needs a DB function (see _audit/backend-report.md).
  const newTotalAura = currentAura + finalPoints + streakBonus;
  const newTier = getTierForAura(newTotalAura);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      total_aura: newTotalAura,
      current_tier: newTier.name,
      streak_days: newStreak,
      last_active_date: today,
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("[submitAuraEvent] Profile update failed:", updateError.message);
    // The event is persisted; totals can be reconciled by the daily job.
  }

  logActivity(user.id, "aura.event.submitted", {
    event_id: eventId,
    points: finalPoints,
    category,
    vibeRoll,
  }).catch(() => {});

  return {
    success: true,
    event: {
      id: eventId,
      description: sanitizePlainText(description, 280),
      aura_points: finalPoints,
      ai_verdict: finalVerdict,
      ai_vibe_tag: vibeTag,
      ai_emoji: emoji,
      category,
      created_at: insertedEvent.created_at,
    },
    aura: {
      points: finalPoints,
      verdict: finalVerdict,
      vibe_tag: vibeTag,
      emoji,
    },
    newTotalAura,
    newTier: newTier.name,
    streakBonus,
    streak: newStreak,
  };
}

// ─────────────────────────────────────────────────────────────
// Public feed
// ─────────────────────────────────────────────────────────────

/**
 * Runs a best-effort read for the feed's interaction state.
 *
 * Aggregates are additive decoration: a failure must never fail an otherwise valid
 * feed, so errors are logged and surface as an empty result.
 */
async function loadFeedRows(
  label: string,
  run: () => Promise<{ data: unknown; error: { message: string } | null }>
): Promise<unknown> {
  try {
    const { data, error } = await run();
    if (error) {
      console.warn(`[getPublicFeed] ${label} query failed:`, error.message);
      return [];
    }
    return data;
  } catch (err) {
    console.warn(`[getPublicFeed] ${label} query threw:`, err instanceof Error ? err.message : "unknown");
    return [];
  }
}

/**
 * Loads the public profile summary for a batch of author ids.
 *
 * The feed cannot embed profiles through PostgREST (the event FK points at
 * `auth.users`), so authors are read in one extra query and merged by id —
 * the same pattern the interaction state below already uses.
 */
async function loadAuthorProfiles(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, PublicProfileSummary>> {
  const byId = new Map<string, PublicProfileSummary>();
  if (userIds.length === 0) return byId;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, current_tier, total_aura, is_premium")
    .in("id", userIds);

  if (error) {
    console.warn("[getPublicFeed] author profiles query failed:", error.message);
    return byId;
  }

  for (const row of Array.isArray(data) ? data : []) {
    const id = (row as { id?: unknown }).id;
    if (typeof id !== "string") continue;
    const profile = normalizePublicProfile(
      row as Partial<Record<keyof PublicProfileSummary, unknown>>
    );
    if (profile) byId.set(id, profile);
  }
  return byId;
}

/**
 * Attaches read-side interaction state to feed rows.
 *
 * `reaction_counts` is aggregated from the `reactions` table and `viewer_vote` /
 * `viewer_reaction` from the viewer's own `votes` / `reactions` rows — the backend
 * maintains no denormalised reaction-count column, so the aggregate has to be read.
 */
async function attachFeedInteractionState(
  supabase: SupabaseClient,
  events: PublicFeedEvent[],
  viewerId: string | null
): Promise<void> {
  if (events.length === 0) return;
  const eventIds = events.map((event) => event.id);

  const [countRows, viewerReactionRows, viewerVoteRows] = await Promise.all([
    loadFeedRows("reaction counts", async () => {
      const { data, error } = await supabase
        .from("reactions")
        .select("event_id, type")
        .in("event_id", eventIds);
      return { data, error };
    }),
    viewerId
      ? loadFeedRows("viewer reactions", async () => {
          const { data, error } = await supabase
            .from("reactions")
            .select("event_id, type")
            .in("event_id", eventIds)
            .eq("user_id", viewerId);
          return { data, error };
        })
      : Promise.resolve([] as unknown),
    viewerId
      ? loadFeedRows("viewer votes", async () => {
          const { data, error } = await supabase
            .from("votes")
            .select("event_id, value")
            .in("event_id", eventIds)
            .eq("user_id", viewerId);
          return { data, error };
        })
      : Promise.resolve([] as unknown),
  ]);

  const counts = aggregateReactionCounts(countRows);
  const viewerReactions = indexViewerReactions(viewerReactionRows);
  const viewerVotes = indexViewerVotes(viewerVoteRows);

  for (const event of events) {
    event.reaction_counts = counts.get(event.id) ?? {};
    event.viewer_vote = viewerVotes.get(event.id) ?? null;
    event.viewer_reaction = viewerReactions.get(event.id) ?? null;
  }
}

export async function getPublicFeed(
  tab: "hot" | "fresh" | "top" = "hot",
  page: number = 0,
  limit: number = 20
): Promise<PublicFeedResult> {
  const supabase = await createClient();

  // The feed is public, but when a viewer is signed in we also return their own
  // vote/reaction per row so the card can render its pressed state after a refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  const safeTab: "hot" | "fresh" | "top" = tab === "fresh" || tab === "top" ? tab : "hot";
  const safeLimit = boundedInt(limit, 1, 50, 20);
  const safePage = boundedInt(page, 0, 1000, 0);
  const from = safePage * safeLimit;
  const to = from + safeLimit - 1;

  // NOTE: `aura_events.user_id` references `auth.users`, NOT `profiles`, so a
  // PostgREST embed (`profiles!aura_events_user_id_fkey`) can never resolve — it
  // failed every dashboard load with "Could not find a relationship between
  // 'aura_events' and 'profiles'". Author profiles are fetched separately below
  // and merged in code.
  let query = supabase.from("aura_events").select("*").eq("is_public", true);

  switch (safeTab) {
    case "hot": {
      // Most upvoted in the last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", oneDayAgo).order("upvotes", { ascending: false });
      break;
    }
    case "fresh":
      query = query.order("created_at", { ascending: false });
      break;
    case "top":
      query = query.order("upvotes", { ascending: false });
      break;
  }

  const { data, error } = await query.range(from, to);

  if (error) {
    console.error("[getPublicFeed]", error.message);
    // Distinguish "couldn't load" from "no entries" for the caller.
    return { events: [], hasMore: false, error: "Failed to load the feed" };
  }

  const rows = Array.isArray(data) ? data : [];
  const profilesById = await loadAuthorProfiles(
    supabase,
    [...new Set(rows.map((raw) => (raw as { user_id?: unknown }).user_id))]
      .filter((id): id is string => typeof id === "string")
  );

  const events: PublicFeedEvent[] = [];
  for (const raw of rows) {
    const row = normalizeEventRow(raw as RawEventRow);
    if (!row) continue;
    events.push({
      ...row,
      profiles: profilesById.get(row.user_id) ?? null,
      reaction_counts: {},
      viewer_vote: null,
      viewer_reaction: null,
    });
  }

  await attachFeedInteractionState(supabase, events, viewerId);

  return { events, hasMore: events.length === safeLimit };
}

// ─────────────────────────────────────────────────────────────
// Votes
// ─────────────────────────────────────────────────────────────

/**
 * Recomputes the denormalised counters from the source of truth (`votes`) after a
 * mutation. Counters cannot be incremented atomically without a DB function, so
 * recomputing keeps them converging on the correct value.
 */
async function recomputeVoteCounts(supabase: SupabaseClient, eventId: string): Promise<void> {
  const [up, down] = await Promise.all([
    supabase.from("votes").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("value", 1),
    supabase.from("votes").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("value", -1),
  ]);

  if (up.error || down.error) {
    console.warn("[recomputeVoteCounts] Count failed:", up.error?.message ?? down.error?.message);
    return;
  }

  const { error } = await supabase
    .from("aura_events")
    .update({ upvotes: up.count ?? 0, downvotes: down.count ?? 0 })
    .eq("id", eventId);

  if (error) {
    console.warn("[recomputeVoteCounts] Update failed:", error.message);
  }
}

export async function voteOnEvent(eventId: string, value: VoteValue): Promise<VoteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Must be logged in" };

  if (!isSafeId(eventId) || !isVoteValue(value)) {
    return { error: "Invalid vote" };
  }

  // Check existing vote
  const { data: existing, error: existingError } = await supabase
    .from("votes")
    .select("id, value")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    console.error("[voteOnEvent] Lookup failed:", existingError.message);
    return { error: "Failed to vote" };
  }

  if (existing) {
    const existingVote = existing as { id: string; value: number };

    if (existingVote.value === value) {
      const { error } = await supabase.from("votes").delete().eq("id", existingVote.id).eq("user_id", user.id);
      if (error) return { error: "Failed to vote" };
      await recomputeVoteCounts(supabase, eventId);
      return { success: true, action: "removed" };
    }

    const { error } = await supabase
      .from("votes")
      .update({ value })
      .eq("id", existingVote.id)
      .eq("user_id", user.id);
    if (error) return { error: "Failed to vote" };
    await recomputeVoteCounts(supabase, eventId);
    return { success: true, action: "switched" };
  }

  const { error } = await supabase.from("votes").insert({
    event_id: eventId,
    user_id: user.id,
    value,
  });

  if (error) {
    console.error("[voteOnEvent] Insert failed:", error.message);
    return { error: "Failed to vote" };
  }

  await recomputeVoteCounts(supabase, eventId);
  return { success: true, action: "voted" };
}

/**
 * Adds / switches / removes a reaction.
 *
 * `type` is typed as `string` for caller compatibility but is runtime-validated
 * against `REACTION_TYPES` (a Server Action is reachable by direct POST, so the
 * allowlist — not the TypeScript type — is the security boundary).
 */
export async function reactToEvent(eventId: string, type: string): Promise<ReactionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Must be logged in" };

  // Runtime allowlist: `type` arrives from the client and is stored/rendered later.
  if (!isSafeId(eventId) || !isReactionType(type)) {
    return { error: "Invalid reaction" };
  }

  const { data: existing, error: existingError } = await supabase
    .from("reactions")
    .select("id, type")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    console.error("[reactToEvent] Lookup failed:", existingError.message);
    return { error: "Failed to react" };
  }

  if (existing) {
    const existingReaction = existing as { id: string; type: string };

    if (existingReaction.type === type) {
      const { error } = await supabase
        .from("reactions")
        .delete()
        .eq("id", existingReaction.id)
        .eq("user_id", user.id);
      if (error) return { error: "Failed to react" };
      return { success: true, action: "removed" };
    }

    const { error } = await supabase
      .from("reactions")
      .update({ type })
      .eq("id", existingReaction.id)
      .eq("user_id", user.id);
    if (error) return { error: "Failed to react" };
    return { success: true, action: "switched" };
  }

  const { error } = await supabase.from("reactions").insert({
    event_id: eventId,
    user_id: user.id,
    type,
  });

  if (error) {
    console.error("[reactToEvent] Insert failed:", error.message);
    return { error: "Failed to react" };
  }

  return { success: true, action: "reacted" };
}

// ─────────────────────────────────────────────────────────────
// Leaderboard
// ─────────────────────────────────────────────────────────────

export async function getLeaderboard(
  period: "daily" | "weekly" | "alltime" = "alltime",
  page: number = 0,
  limit: number = 50
): Promise<LeaderboardResult> {
  const supabase = await createClient();

  const safePeriod: "daily" | "weekly" | "alltime" =
    period === "daily" || period === "weekly" ? period : "alltime";
  const safeLimit = boundedInt(limit, 1, 100, 50);
  const safePage = boundedInt(page, 0, 1000, 0);
  const from = safePage * safeLimit;
  const to = from + safeLimit - 1;

  if (safePeriod === "alltime") {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, total_aura, current_tier, streak_days, is_premium")
      .order("total_aura", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("[getLeaderboard]", error.message);
      return { users: [], hasMore: false };
    }

    const rows = (data ?? []) as Omit<LeaderboardUser, "rank">[];
    return {
      users: rows.map((user, index) => ({ ...user, rank: from + index + 1 })),
      hasMore: rows.length === safeLimit,
    };
  }

  const now = new Date();
  let since: Date;

  if (safePeriod === "daily") {
    since = new Date(now);
    since.setHours(0, 0, 0, 0);
  } else {
    since = new Date(now);
    since.setDate(since.getDate() - 7);
    since.setHours(0, 0, 0, 0);
  }

  const { data: events, error } = await supabase
    .from("aura_events")
    .select("user_id, aura_points")
    .gte("created_at", since.toISOString());

  if (error) {
    console.error("[getLeaderboard]", error.message);
    return { users: [], hasMore: false };
  }

  const userAuraMap = new Map<string, number>();
  for (const event of (events ?? []) as { user_id: string; aura_points: number | null }[]) {
    const uid = event.user_id;
    if (typeof uid !== "string" || uid.length === 0) continue;
    userAuraMap.set(uid, (userAuraMap.get(uid) ?? 0) + (Number(event.aura_points) || 0));
  }

  const sorted = [...userAuraMap.entries()].sort((a, b) => b[1] - a[1]).slice(from, to + 1);

  if (sorted.length === 0) {
    return { users: [], hasMore: false };
  }

  const userIds = sorted.map(([uid]) => uid);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, current_tier, streak_days, is_premium")
    .in("id", userIds);

  if (profilesError) {
    console.error("[getLeaderboard]", profilesError.message);
    return { users: [], hasMore: false };
  }

  type PeriodProfile = Omit<LeaderboardUser, "rank" | "total_aura">;
  const profileMap = new Map<string, PeriodProfile>(
    ((profiles ?? []) as PeriodProfile[]).map((p) => [p.id, p])
  );

  const users: LeaderboardUser[] = sorted.map(([uid, periodAura], index) => {
    const profile = profileMap.get(uid);
    return {
      id: uid,
      username: profile?.username ?? null,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      current_tier: profile?.current_tier ?? null,
      streak_days: profile?.streak_days ?? null,
      is_premium: profile?.is_premium ?? null,
      total_aura: periodAura,
      rank: from + index + 1,
    };
  });

  return { users, hasMore: sorted.length === safeLimit };
}

// ─────────────────────────────────────────────────────────────
// Public profile
// ─────────────────────────────────────────────────────────────

export async function getUserProfile(username: string): Promise<UserProfileResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The profile page lives behind auth; keep this action authenticated too, since
  // every Server Action is independently reachable by direct POST.
  if (!user) {
    return { error: "Must be logged in" };
  }

  const parsedUsername = usernameSchema.safeParse(username);
  if (!parsedUsername.success) {
    return { error: "User not found" };
  }

  // Explicit public columns — never `select("*")` on another user's row.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, current_tier, total_aura, streak_days, created_at")
    .eq("username", parsedUsername.data)
    .maybeSingle();

  if (error || !profile) {
    return { error: "User not found" };
  }

  const row = profile as {
    id?: unknown;
    username?: unknown;
    display_name?: unknown;
    avatar_url?: unknown;
    current_tier?: unknown;
    total_aura?: unknown;
    streak_days?: unknown;
    created_at?: unknown;
  };

  const typedProfile: UserProfileRecord = {
    id: typeof row.id === "string" ? row.id : "",
    username: typeof row.username === "string" ? row.username : "",
    display_name: typeof row.display_name === "string" ? row.display_name : null,
    avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : null,
    current_tier: typeof row.current_tier === "string" ? row.current_tier : null,
    total_aura: Number.isFinite(Number(row.total_aura)) ? Number(row.total_aura) : null,
    streak_days: Number.isFinite(Number(row.streak_days)) ? Number(row.streak_days) : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
  };

  if (!typedProfile.id) {
    return { error: "User not found" };
  }

  const { data: events } = await supabase
    .from("aura_events")
    .select("*")
    .eq("user_id", typedProfile.id)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(20);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: history } = await supabase
    .from("aura_events")
    .select("aura_points, created_at")
    .eq("user_id", typedProfile.id)
    .eq("is_public", true)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: true });

  const historyPoints: AuraHistoryPoint[] = [];
  for (const point of Array.isArray(history) ? history : []) {
    const raw = point as { aura_points?: unknown; created_at?: unknown };
    if (typeof raw.created_at !== "string") continue;
    historyPoints.push({
      aura_points: Number.isFinite(Number(raw.aura_points)) ? Number(raw.aura_points) : 0,
      created_at: raw.created_at,
    });
  }

  return {
    profile: typedProfile,
    events: normalizeEventRows(events),
    history: historyPoints,
  };
}

// ─────────────────────────────────────────────────────────────
// Profile updates
// ─────────────────────────────────────────────────────────────

export async function updateProfile(newUsername: string, newDisplayName: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Must be logged in" };

  const parsedUsername = usernameSchema.safeParse(newUsername);
  if (!parsedUsername.success) {
    return { error: "Username must be 3-20 characters, only letters, numbers, and underscores" };
  }
  const username = parsedUsername.data;

  const parsedDisplayName = displayNameSchema.safeParse(newDisplayName);
  if (!parsedDisplayName.success) {
    return { error: "Display name is too long" };
  }
  const displayName = parsedDisplayName.data;

  const { profile, error: profileErr } = await getOwnProfile(supabase, user.id);
  if (profileErr || !profile) {
    return { error: "Profile not found" };
  }

  const isUsernameChanging = profile.username !== username;
  let updatedChanges: string[] = Array.isArray(profile.username_changes)
    ? (profile.username_changes as unknown[]).filter((v): v is string => typeof v === "string")
    : [];

  if (isUsernameChanging) {
    // Case-insensitive uniqueness (escape LIKE wildcards so `_` matches literally).
    const escaped = username.replace(/[\\%_]/g, "\\$&");
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", escaped)
      .neq("id", user.id)
      .maybeSingle();

    if (existing) {
      return { error: "Username already taken" };
    }

    // Twice every 15 days
    const now = new Date();
    const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

    const recentChanges = updatedChanges.filter((changeStr) => {
      const changeDate = new Date(changeStr);
      return Number.isFinite(changeDate.getTime()) && changeDate >= fifteenDaysAgo;
    });

    if (recentChanges.length >= 2) {
      return { error: "You can only change your username twice every 15 days." };
    }

    updatedChanges = [...recentChanges, now.toISOString()];
  }

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({
      username,
      display_name: displayName,
      username_changes: updatedChanges,
    })
    .eq("id", user.id);

  if (updateErr) {
    console.error("[updateProfile] Update failed:", updateErr.message);
    return { error: "Failed to update profile details" };
  }

  if (isUsernameChanging) {
    logActivity(user.id, "profile.username.changed", { new_username: username }).catch(() => {});
  }

  return { success: true };
}

export async function updateUsername(newUsername: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Must be logged in" };

  const { profile } = await getOwnProfile(supabase, user.id);
  const currentDisplayName = profile?.display_name ?? "";

  return await updateProfile(newUsername, currentDisplayName);
}

// ─────────────────────────────────────────────────────────────
// Boost (premium)
// ─────────────────────────────────────────────────────────────

export async function boostEvent(eventId: string): Promise<BoostResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Must be logged in" };

  if (!isSafeId(eventId)) return { error: "Invalid event" };

  const { profile } = await getOwnProfile(supabase, user.id);

  if (!profile || !profile.is_premium) {
    return { error: "Boost is a Premium feature. Upgrade to unlock!" };
  }

  const boostsLeft = profile.boosts_remaining ?? 0;
  if (boostsLeft <= 0) {
    return { error: "No boosts remaining this month. Resets on the 1st!" };
  }

  // Ownership + not-already-boosted, enforced by the conditional update itself.
  const { data: boosted, error: boostErr } = await supabase
    .from("aura_events")
    .update({ is_boosted: true, boosted_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("user_id", user.id)
    .eq("is_boosted", false)
    .select("id");

  if (boostErr) {
    console.error("[boostEvent] Boost failed:", boostErr.message);
    return { error: "Failed to boost event" };
  }

  if (!boosted || boosted.length === 0) {
    // Either not the owner, not found, or already boosted — do not leak which.
    return { error: "You can only boost your own, not-yet-boosted events" };
  }

  // Compare-and-swap the balance so concurrent boosts cannot overspend.
  const { data: debited, error: debitErr } = await supabase
    .from("profiles")
    .update({ boosts_remaining: boostsLeft - 1 })
    .eq("id", user.id)
    .eq("boosts_remaining", boostsLeft)
    .select("id");

  if (debitErr || !debited || debited.length === 0) {
    console.error("[boostEvent] Debit failed:", debitErr?.message ?? "conflict");
    // Compensate: undo the boost so the user is not charged twice for one boost.
    const { error: revertErr } = await supabase
      .from("aura_events")
      .update({ is_boosted: false, boosted_at: null })
      .eq("id", eventId)
      .eq("user_id", user.id);
    if (revertErr) {
      console.error("[boostEvent] CRITICAL: revert failed:", revertErr.message);
    }
    return { error: "Boost conflict — please try again" };
  }

  logActivity(user.id, "event.boosted", { event_id: eventId }).catch(() => {});

  return { success: true, boostsRemaining: boostsLeft - 1 };
}

// ─────────────────────────────────────────────────────────────
// Analytics (premium dashboard)
// ─────────────────────────────────────────────────────────────

export type AnalyticsProfile = {
  total_aura: number | null;
  current_tier: string | null;
  streak_days: number | null;
  is_premium: boolean | null;
  boosts_remaining: number | null;
  created_at: string | null;
} | null;

export type AnalyticsStats = {
  totalEvents: number;
  totalWins: number;
  totalLosses: number;
  totalGain: number;
  totalLoss: number;
  netAura: number;
  winRate: number;
  avgPoints: number;
  boostedCount: number;
};

export type AnalyticsDailyPoint = {
  date: string;
  label: string;
  gain: number;
  loss: number;
  net: number;
  count: number;
};

export type AnalyticsCategoryStat = {
  category: string;
  total: number;
  count: number;
  wins: number;
  losses: number;
  avgPoints: number;
};

export type AnalyticsVibeStat = { tag: string; count: number };

export type AnalyticsHighlights = {
  topWin: { description: string; points: number } | null;
  topLoss: { description: string; points: number } | null;
  mostVoted: { description: string; upvotes: number } | null;
};

export type AnalyticsData = {
  profile: AnalyticsProfile;
  stats: AnalyticsStats;
  dailyTrend: AnalyticsDailyPoint[];
  categoryBreakdown: AnalyticsCategoryStat[];
  vibeDistribution: AnalyticsVibeStat[];
  highlights: AnalyticsHighlights;
};

/** Discriminated by `error` / `isEmpty`; narrow before reading the payload. */
export type AnalyticsResult =
  | {
      error: string;
      isEmpty?: undefined;
      events?: undefined;
      profile?: undefined;
      stats?: undefined;
      dailyTrend?: undefined;
      categoryBreakdown?: undefined;
      vibeDistribution?: undefined;
      highlights?: undefined;
    }
  | {
      error?: undefined;
      isEmpty: true;
      events: never[];
      profile?: undefined;
      stats?: undefined;
      dailyTrend?: undefined;
      categoryBreakdown?: undefined;
      vibeDistribution?: undefined;
      highlights?: undefined;
    }
  | ({ error?: undefined; isEmpty?: undefined; events?: never } & AnalyticsData);

export async function getAnalyticsData(): Promise<AnalyticsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Must be logged in" };

  type AnalyticsEvent = {
    aura_points: number | null;
    category: string | null;
    created_at: string;
    ai_vibe_tag: string | null;
    description: string | null;
    upvotes: number | null;
    is_boosted: boolean | null;
  };

  // Fetch the user's own events (max 500 for perf)
  const { data: events, error } = await supabase
    .from("aura_events")
    .select("aura_points, category, created_at, ai_vibe_tag, description, upvotes, is_boosted")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    console.error("[getAnalyticsData] Event query failed:", error.message);
    return { error: "Failed to load analytics" };
  }

  if (!events || events.length === 0) return { events: [], isEmpty: true };

  const typedEvents = events as AnalyticsEvent[];

  const { data: profile } = await supabase
    .from("profiles")
    .select("total_aura, current_tier, streak_days, is_premium, boosts_remaining, created_at")
    .eq("id", user.id)
    .maybeSingle();

  // ── Daily trend (last 30 days) ──
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dailyMap = new Map<string, { gain: number; loss: number; count: number }>();

  for (const d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
    dailyMap.set(d.toISOString().split("T")[0], { gain: 0, loss: 0, count: 0 });
  }

  for (const e of typedEvents) {
    const day = new Date(e.created_at).toISOString().split("T")[0];
    const entry = dailyMap.get(day);
    if (!entry) continue;
    const points = Number(e.aura_points) || 0;
    // A zero-point strike is neutral: it moves neither the gain nor the loss bucket.
    if (points > 0) entry.gain += points;
    else if (points < 0) entry.loss += Math.abs(points);
    entry.count++;
  }

  const dailyTrend: AnalyticsDailyPoint[] = Array.from(dailyMap.entries()).map(([date, data]) => ({
    date,
    label: new Date(date).toLocaleDateString("en", { month: "short", day: "numeric" }),
    gain: data.gain,
    loss: data.loss,
    net: data.gain - data.loss,
    count: data.count,
  }));

  // ── Category breakdown ──
  const categoryMap = new Map<string, { total: number; count: number; wins: number; losses: number }>();
  for (const e of typedEvents) {
    const cat = e.category || "random";
    const entry = categoryMap.get(cat) ?? { total: 0, count: 0, wins: 0, losses: 0 };
    const points = Number(e.aura_points) || 0;
    entry.total += points;
    entry.count++;
    // Wins require a strictly positive strike; zero is neither a win nor a loss.
    if (points > 0) entry.wins++;
    else if (points < 0) entry.losses++;
    categoryMap.set(cat, entry);
  }

  const categoryBreakdown: AnalyticsCategoryStat[] = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      total: data.total,
      count: data.count,
      wins: data.wins,
      losses: data.losses,
      avgPoints: data.count > 0 ? Math.round(data.total / data.count) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // ── Win/loss stats ──
  // Zero-point strikes are neutral outcomes: they are neither a win nor a loss,
  // and they must not dilute the win rate. Only scored events participate.
  const wins = typedEvents.filter((e) => (Number(e.aura_points) || 0) > 0);
  const losses = typedEvents.filter((e) => (Number(e.aura_points) || 0) < 0);
  const totalGain = wins.reduce((s, e) => s + (Number(e.aura_points) || 0), 0);
  const totalLoss = losses.reduce((s, e) => s + Math.abs(Number(e.aura_points) || 0), 0);
  const totalEvents = typedEvents.length;
  const scoredEvents = wins.length + losses.length;

  const stats: AnalyticsStats = {
    totalEvents,
    totalWins: wins.length,
    totalLosses: losses.length,
    totalGain,
    totalLoss,
    netAura: totalGain - totalLoss,
    winRate: scoredEvents > 0 ? Math.round((wins.length / scoredEvents) * 100) : 0,
    avgPoints: totalEvents > 0 ? Math.round((totalGain - totalLoss) / totalEvents) : 0,
    boostedCount: typedEvents.filter((e) => e.is_boosted).length,
  };

  // ── Highlights ──
  const sortedByMagnitude = [...typedEvents].sort(
    (a, b) => Math.abs(Number(b.aura_points) || 0) - Math.abs(Number(a.aura_points) || 0)
  );
  const topWin = sortedByMagnitude.find((e) => (Number(e.aura_points) || 0) > 0);
  const topLoss = sortedByMagnitude.find((e) => (Number(e.aura_points) || 0) < 0);
  const mostVoted = [...typedEvents].sort((a, b) => (Number(b.upvotes) || 0) - (Number(a.upvotes) || 0))[0];

  const highlights: AnalyticsHighlights = {
    topWin: topWin
      ? { description: topWin.description ?? "", points: Number(topWin.aura_points) || 0 }
      : null,
    topLoss: topLoss
      ? { description: topLoss.description ?? "", points: Number(topLoss.aura_points) || 0 }
      : null,
    mostVoted: mostVoted
      ? { description: mostVoted.description ?? "", upvotes: Number(mostVoted.upvotes) || 0 }
      : null,
  };

  // ── Vibe tag distribution ──
  const vibeMap = new Map<string, number>();
  for (const e of typedEvents) {
    const tag = truncateCodePoints(e.ai_vibe_tag, 40);
    if (tag) vibeMap.set(tag, (vibeMap.get(tag) ?? 0) + 1);
  }
  const vibeDistribution: AnalyticsVibeStat[] = Array.from(vibeMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    profile: (profile as AnalyticsProfile) ?? null,
    stats,
    dailyTrend,
    categoryBreakdown,
    vibeDistribution,
    highlights,
  };
}
