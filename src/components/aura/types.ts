/**
 * Shared view-model types for AuraMint UI.
 *
 * These describe the *shape the UI needs* from the server. They are intentionally
 * permissive (nullable columns, optional fields) so a backend field rename shows up
 * as a type error here instead of silently rendering `undefined`.
 */

export type FeedTab = "hot" | "fresh" | "top";
export type LeaderboardPeriod = "daily" | "weekly" | "alltime";

/** Author profile summary attached to feed rows (read separately — no DB relationship exists). */
export type EventProfile = {
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  current_tier?: string | null;
  total_aura?: number | null;
  is_premium?: boolean | null;
};

export type AuraEvent = {
  id: string;
  user_id: string;
  description: string;
  aura_points: number;
  ai_verdict?: string | null;
  ai_vibe_tag?: string | null;
  ai_emoji?: string | null;
  category?: string | null;
  upvotes?: number | null;
  downvotes?: number | null;
  reaction_counts?: Record<string, number> | null;
  viewer_vote?: 1 | -1 | null;
  viewer_reaction?: string | null;
  created_at: string;
  is_boosted?: boolean | null;
  profiles?: EventProfile | EventProfile[] | null;
};

/** A single wall-clock point used by the profile aura chart. */
export type AuraHistoryPoint = {
  aura_points: number;
  created_at: string;
};

export type PublicProfile = {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  total_aura?: number | null;
  current_tier?: string | null;
  streak_days?: number | null;
  is_premium?: boolean | null;
  created_at?: string | null;
  bio?: string | null;
};

export type LeaderboardUser = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  total_aura: number;
  current_tier?: string | null;
  streak_days?: number | null;
  is_premium?: boolean | null;
  rank?: number | null;
};

/** Return shape of `voteOnEvent` / `reactToEvent`. */
export type InteractionResult = {
  success?: boolean;
  action?: "removed" | "switched" | "voted" | "reacted" | string;
  error?: string;
};

/** Return shape of `boostEvent`. */
export type BoostResult = {
  success?: boolean;
  boostsRemaining?: number;
  error?: string;
};

/** Result of `submitAuraEvent` used by the reveal screen. */
export type SubmitAuraResult = {
  success?: boolean;
  error?: string;
  event?: {
    id: string;
    description: string;
    aura_points: number;
    ai_verdict?: string | null;
    ai_vibe_tag?: string | null;
    ai_emoji?: string | null;
  };
  aura?: {
    points: number;
    verdict: string;
    vibe_tag: string;
    emoji: string;
  };
  newTotalAura?: number;
  newTier?: string;
  streakBonus?: number;
  streak?: number;
};
