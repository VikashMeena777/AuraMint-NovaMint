"use client";

import {
  Sprout,
  NotebookPen,
  Sun,
  Flame,
  Star,
  Swords,
  Trophy,
  Sparkle,
  Gem,
  CalendarCheck,
  Clapperboard,
  Skull,
  Mountain,
  Crown,
  BadgeCheck,
  Banknote,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Deterministic mark per badge id — one icon system for the whole hallmark sheet. */
const BADGE_ICONS: Record<string, LucideIcon> = {
  "first-event": Sprout,
  "ten-events": NotebookPen,
  "positive-vibes": Sun,
  "streak-3": Flame,
  "fifty-events": Star,
  "streak-7": Swords,
  "big-w": Trophy,
  "rising-star": Sparkle,
  "hundred-events": Gem,
  "streak-30": CalendarCheck,
  "main-character": Clapperboard,
  "big-l": Skull,
  "streak-100": Mountain,
  "god-mode": Crown,
  "premium-supporter": BadgeCheck,
  "aura-millionaire": Banknote,
};

const FALLBACK_ICON: LucideIcon = Star;

export type Rarity = "common" | "rare" | "epic" | "legendary";

export const RARITY_META: Record<Rarity, { label: string; text: string }> = {
  common: { label: "Common", text: "text-[hsl(var(--muted-foreground))]" },
  rare: { label: "Rare", text: "text-[#1B3A5C] dark:text-[#7FB0DC]" },
  epic: { label: "Epic", text: "text-[var(--patina-400)]" },
  legendary: { label: "Legendary", text: "text-[var(--brass-500)]" },
};

/**
 * Rarity → shared hallmark tone. `.hallmark` is brass by default (legendary), the rest
 * map onto the system's lead/positive tones. Badges reuse the same struck frame as the
 * tier marks so the product has exactly one stamp shape.
 */
const RARITY_TONE: Record<Rarity, string> = {
  common: "hallmark-lead",
  rare: "hallmark-lead",
  epic: "hallmark-positive",
  legendary: "",
};

export function badgeIcon(id: string): LucideIcon {
  return BADGE_ICONS[id] ?? FALLBACK_ICON;
}

/**
 * A struck (earned) or blank (locked) badge plate. Locked badges are lead outlines with a
 * padlock — never a greyed-out colour icon, and never a bouncing emoji.
 */
export function BadgeStamp({
  id,
  rarity,
  earned,
  size = "lg",
  className,
}: {
  id: string;
  rarity: Rarity;
  earned: boolean;
  size?: "md" | "lg" | "xl";
  className?: string;
}) {
  // Index the map directly (calling a lookup during render reads as creating a component).
  const Icon = BADGE_ICONS[id] ?? FALLBACK_ICON;
  const frame = size === "xl" ? "hallmark hallmark-lg" : size === "lg" ? "hallmark hallmark-lg" : "hallmark";
  const icon = size === "xl" ? "size-8" : size === "lg" ? "size-6" : "size-4";

  return (
    <span
      className={cn(frame, RARITY_TONE[rarity], !earned && "opacity-55", className)}
      style={size === "xl" ? { width: "4.5rem", height: "4.5rem" } : undefined}
      aria-hidden="true"
    >
      {earned ? (
        <Icon className={icon} strokeWidth={1.75} />
      ) : (
        <Lock className={cn(icon, "opacity-80")} strokeWidth={1.75} />
      )}
    </span>
  );
}
