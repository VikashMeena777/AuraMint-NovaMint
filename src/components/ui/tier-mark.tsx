import * as React from "react";
import {
  Crown,
  Flame,
  Ghost,
  Skull,
  Star,
  Sun,
  User,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Tier hallmarks — one mark, one tone, one place to change them.
 *
 * The eight tier names come from `AURA_TIERS` (src/lib/ai/prompts.ts), the only
 * real ladder in the product. Emoji tier glyphs are replaced by struck Lucide
 * marks so the feed, leaderboard, sidebar and landing all show the same sigil
 * at the same optical weight.
 */
export type TierMarkMeta = {
  Icon: LucideIcon;
  /** Hallmark frame tone. */
  tone: "default" | "lead" | "positive" | "negative" | "brass";
  /** Short, plain-language gloss used on the landing ladder. */
  gloss: string;
};

export const TIER_MARKS: Record<string, TierMarkMeta> = {
  "Negative Aura": { Icon: Skull, tone: "negative", gloss: "You radiate anti-energy" },
  NPC: { Icon: Ghost, tone: "lead", gloss: "Background character energy" },
  Civilian: { Icon: User, tone: "default", gloss: "You exist, barely noticed" },
  "Rising Star": { Icon: Star, tone: "default", gloss: "People are starting to notice" },
  "Main Character": { Icon: Flame, tone: "positive", gloss: "The plot revolves around you" },
  Legendary: { Icon: Crown, tone: "brass", gloss: "Songs will be written about you" },
  Mythical: { Icon: Zap, tone: "brass", gloss: "Mere mortals tremble" },
  "GOD MODE": { Icon: Sun, tone: "brass", gloss: "You ARE the universe" },
};

export const TIER_MARK_FALLBACK: TierMarkMeta = TIER_MARKS.NPC;

const toneClass: Record<TierMarkMeta["tone"], string> = {
  // `.hallmark` is already brass, so the prestige tone needs no extra class.
  default: "hallmark-lead",
  lead: "hallmark-lead",
  positive: "hallmark-positive",
  negative: "hallmark-negative",
  brass: "",
};

export function tierMarkFor(tier: string | null | undefined): TierMarkMeta {
  if (!tier) return TIER_MARK_FALLBACK;
  return TIER_MARKS[tier] ?? TIER_MARK_FALLBACK;
}

/**
 * A struck hallmark: the tier sigil inside a notched stamp frame.
 * `size` sets the frame; the icon stays proportional.
 */
function TierMark({
  tier,
  size = "md",
  withLabel = false,
  className,
}: {
  tier: string | null | undefined;
  size?: "sm" | "md" | "lg";
  withLabel?: boolean;
  className?: string;
}) {
  const meta = tierMarkFor(tier);
  const frame = size === "sm" ? "size-7" : size === "lg" ? "size-12" : "size-9";
  const icon = size === "sm" ? "size-3.5" : size === "lg" ? "size-6" : "size-4";

  if (!withLabel) {
    return (
      <span
        className={cn("hallmark", frame, toneClass[meta.tone], className)}
        role="img"
        aria-label={`${tier ?? "NPC"} tier hallmark`}
      >
        <meta.Icon className={icon} strokeWidth={1.75} aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={cn("hallmark", frame, toneClass[meta.tone], className)}
      >
        <meta.Icon className={icon} strokeWidth={1.75} />
      </span>
      <span className="label-micro">{tier}</span>
    </span>
  );
}

export { TierMark };
