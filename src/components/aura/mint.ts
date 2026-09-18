/**
 * "The Mint" design tokens and presentation metadata for AuraMint.
 *
 * Single source of truth for the scoped UI: colours, tier hallmarks, category marks,
 * reaction tokens and the number/format helpers that used to be duplicated (and got the
 * sign wrong) in eleven call sites.
 *
 * Colour rules (see `_audit/ui-research.md` §9):
 *  - patina  = brand + positive aura
 *  - brass   = prestige / premium / legendary ONLY (never a body CTA)
 *  - oxide   = negative aura / loss
 *  - lead    = neutral, NPC, locked
 *  - engrave = third hue, data-viz fills only
 * No violet. No gradient text on numbers. Neutrals stay on the semantic `--card` /
 * `--foreground` / `--border` tokens so the shell's paper/ink repaint flows through.
 */
import {
  Heart,
  GraduationCap,
  Briefcase,
  Dumbbell,
  PartyPopper,
  Home,
  Dices,
  type LucideIcon,
} from "lucide-react";

/* ─────────────────────────────── palette ─────────────────────────────── */

export const MINT = {
  patina: "#1F6F5C",
  patinaDeep: "#16564A",
  patinaBright: "#2E9E7A",
  patinaLight: "#3FB68C",
  brass: "#C9A227",
  brassDeep: "#A88418",
  brassDark: "#8A6E14",
  oxide: "#B4442E",
  oxideDeep: "#9E3A26",
  oxideLight: "#E0795F",
  lead: "#7A7F87",
  engrave: "#1B3A5C",
} as const;

/** Class strings — keep in one place so a token change is one edit. */
export const TONE = {
  posText: "text-[#16604F] dark:text-[#43B994]",
  negText: "text-[#9E3A26] dark:text-[#E0795F]",
  brassText: "text-[#8A6E14] dark:text-[#C9A227]",
  leadText: "text-[#6B7078] dark:text-[#9BA1A9]",
  posBg: "bg-[#1F6F5C] text-[#F7F4EC]",
  posBgSoft: "bg-[#1F6F5C]/10 text-[#16604F] dark:text-[#43B994] border-[#1F6F5C]/25",
  negBgSoft: "bg-[#B4442E]/10 text-[#9E3A26] dark:text-[#E0795F] border-[#B4442E]/25",
  brassBgSoft: "bg-[#C9A227]/12 text-[#8A6E14] dark:text-[#C9A227] border-[#C9A227]/30",
  leadBgSoft: "bg-[#7A7F87]/10 text-[#6B7078] dark:text-[#9BA1A9] border-[#7A7F87]/25",
  railPos: "border-l-[3px] border-l-[#2E9E7A]",
  railNeg: "border-l-[3px] border-l-[#B4442E]",
  /** Solid plate — replaces `.glass` / `.glass-card` inside my surfaces. */
  plate: "bg-card border border-border/70 shadow-sm",
} as const;

export function polarityText(points: number): string {
  return points < 0 ? TONE.negText : TONE.posText;
}

export function polarityRail(points: number): string {
  return points < 0 ? TONE.railNeg : TONE.railPos;
}

/* ─────────────────────────────── numbers ─────────────────────────────── */

/** Signed, magnitude-abbreviated aura value. The ONLY place the `+` is added. */
export function formatSignedAura(points: number): string {
  if (!Number.isFinite(points)) return "0";
  const rounded = Math.round(points);
  const body = abbreviate(Math.abs(rounded));
  if (rounded > 0) return `+${body}`;
  if (rounded < 0) return `-${body}`;
  return "0";
}

/** Ledger balance: no `+`, sign only when negative (e.g. `1.2K`, `-420`). */
export function formatAuraBalance(points: number): string {
  if (!Number.isFinite(points)) return "0";
  const rounded = Math.round(points);
  return rounded < 0 ? `-${abbreviate(Math.abs(rounded))}` : abbreviate(rounded);
}

function abbreviate(abs: number): string {
  // Same grouping rule as the shared number renderer (en-IN), so a figure can never read
  // "1.3K" in a share text and "1,250" on the plate that produced it.
  return new Intl.NumberFormat("en-IN").format(Math.round(abs));
}

/* ─────────────────────────────── tiers ─────────────────────────────── */

/**
 * Canonical tier names live in `AURA_TIERS` (backend-owned prompts module). Tier marks
 * and tones are owned by the shared `src/components/ui/tier-mark.tsx` (shell-owned), so
 * this file only needs to normalise an unknown/missing tier to a real name.
 */
export const TIER_NAMES = [
  "Negative Aura",
  "NPC",
  "Civilian",
  "Rising Star",
  "Main Character",
  "Legendary",
  "Mythical",
  "GOD MODE",
] as const;

export function tierName(tier?: string | null): string {
  return tier && (TIER_NAMES as readonly string[]).includes(tier) ? tier : "NPC";
}

/* ─────────────────────────────── categories ─────────────────────────────── */

export type CategoryMeta = { value: string; label: string; icon: LucideIcon };

export const CATEGORY_META: Record<string, CategoryMeta> = {
  crush: { value: "crush", label: "Crush", icon: Heart },
  school: { value: "school", label: "School", icon: GraduationCap },
  work: { value: "work", label: "Work", icon: Briefcase },
  gym: { value: "gym", label: "Gym", icon: Dumbbell },
  social: { value: "social", label: "Social", icon: PartyPopper },
  family: { value: "family", label: "Family", icon: Home },
  random: { value: "random", label: "Random", icon: Dices },
};

export function categoryMeta(value?: string | null): CategoryMeta {
  return CATEGORY_META[value ?? "random"] ?? CATEGORY_META.random;
}

/* ─────────────────────────────── reactions ─────────────────────────────── */

export const REACTIONS = [
  { type: "crown", emoji: "👑", label: "Crown" },
  { type: "skull", emoji: "💀", label: "Skull" },
  { type: "fire", emoji: "🔥", label: "Fire" },
  { type: "yikes", emoji: "😬", label: "Yikes" },
  { type: "iconic", emoji: "✨", label: "Iconic" },
  { type: "npc", emoji: "🗿", label: "NPC" },
] as const;

/* ─────────────────────────────── urls ─────────────────────────────── */

/** Trusted origin: current browser origin, else the configured app URL. */
export function appOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL || "https://auramint.novamintnetworks.in";
}

export function appHost(): string {
  try {
    return new URL(appOrigin()).host;
  } catch {
    return "auramint.novamintnetworks.in";
  }
}

export function eventShareUrl(eventId: string): string {
  return `${appOrigin()}/event/${eventId}`;
}

export function profileShareUrl(username: string): string {
  return `${appOrigin()}/profile/${username}`;
}

/* ─────────────────────────────── misc ─────────────────────────────── */

/** Deterministic PRNG (mulberry32) — replaces `Math.random()` during render. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable numeric seed from a string (event id, tab name, …). */
export function seedFrom(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Initials for an identity plate. */
export function initialOf(name?: string | null): string {
  const clean = (name ?? "").trim();
  return clean ? clean.charAt(0).toUpperCase() : "?";
}
