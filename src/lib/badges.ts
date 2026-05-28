/**
 * Badge definitions for AuraMint.
 * Badges are earned based on specific achievements.
 */

export type Badge = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  requirement: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  check: (stats: UserStats) => boolean;
};

export type UserStats = {
  totalAura: number;
  totalEvents: number;
  streakDays: number;
  biggestW: number;
  biggestL: number;
  tier: string;
  isPremium: boolean;
  daysActive: number;
};

export const BADGES: Badge[] = [
  // ── Common ──
  {
    id: "first-event",
    name: "First Aura",
    emoji: "🌱",
    description: "Logged your first aura event",
    requirement: "1 event",
    rarity: "common",
    check: (s) => s.totalEvents >= 1,
  },
  {
    id: "ten-events",
    name: "Getting Started",
    emoji: "📝",
    description: "Logged 10 aura events",
    requirement: "10 events",
    rarity: "common",
    check: (s) => s.totalEvents >= 10,
  },
  {
    id: "positive-vibes",
    name: "Positive Vibes",
    emoji: "☀️",
    description: "Reached 100+ total aura",
    requirement: "100+ aura",
    rarity: "common",
    check: (s) => s.totalAura >= 100,
  },
  {
    id: "streak-3",
    name: "Consistent",
    emoji: "🔥",
    description: "3-day streak",
    requirement: "3 day streak",
    rarity: "common",
    check: (s) => s.streakDays >= 3,
  },

  // ── Rare ──
  {
    id: "fifty-events",
    name: "Aura Enthusiast",
    emoji: "⭐",
    description: "Logged 50 aura events",
    requirement: "50 events",
    rarity: "rare",
    check: (s) => s.totalEvents >= 50,
  },
  {
    id: "streak-7",
    name: "Weekly Warrior",
    emoji: "⚔️",
    description: "7-day streak",
    requirement: "7 day streak",
    rarity: "rare",
    check: (s) => s.streakDays >= 7,
  },
  {
    id: "big-w",
    name: "Massive W",
    emoji: "🏆",
    description: "Got 5000+ aura in a single event",
    requirement: "5000+ single event",
    rarity: "rare",
    check: (s) => s.biggestW >= 5000,
  },
  {
    id: "rising-star",
    name: "Rising Star",
    emoji: "🌟",
    description: "Reached Rising Star tier",
    requirement: "Rising Star tier",
    rarity: "rare",
    check: (s) => ["Rising Star", "Main Character", "Legendary", "Mythical", "GOD MODE"].includes(s.tier),
  },

  // ── Epic ──
  {
    id: "hundred-events",
    name: "Aura Addict",
    emoji: "💎",
    description: "Logged 100 aura events",
    requirement: "100 events",
    rarity: "epic",
    check: (s) => s.totalEvents >= 100,
  },
  {
    id: "streak-30",
    name: "Monthly Legend",
    emoji: "🗓️",
    description: "30-day streak",
    requirement: "30 day streak",
    rarity: "epic",
    check: (s) => s.streakDays >= 30,
  },
  {
    id: "main-character",
    name: "Main Character",
    emoji: "🎬",
    description: "Reached Main Character tier",
    requirement: "Main Character tier",
    rarity: "epic",
    check: (s) => ["Main Character", "Legendary", "Mythical", "GOD MODE"].includes(s.tier),
  },
  {
    id: "big-l",
    name: "Survived the L",
    emoji: "💀",
    description: "Lost 5000+ aura in a single event and lived to tell the tale",
    requirement: "-5000 single event",
    rarity: "epic",
    check: (s) => s.biggestL <= -5000,
  },

  // ── Legendary ──
  {
    id: "streak-100",
    name: "Unstoppable",
    emoji: "🔱",
    description: "100-day streak",
    requirement: "100 day streak",
    rarity: "legendary",
    check: (s) => s.streakDays >= 100,
  },
  {
    id: "god-mode",
    name: "GOD MODE",
    emoji: "👑",
    description: "Reached GOD MODE tier",
    requirement: "GOD MODE tier",
    rarity: "legendary",
    check: (s) => s.tier === "GOD MODE",
  },
  {
    id: "premium-supporter",
    name: "Premium Supporter",
    emoji: "✨",
    description: "Upgraded to AuraMint+ Premium",
    requirement: "Premium subscription",
    rarity: "legendary",
    check: (s) => s.isPremium,
  },
  {
    id: "aura-millionaire",
    name: "Aura Millionaire",
    emoji: "💰",
    description: "Reached 1,000,000 total aura",
    requirement: "1M+ aura",
    rarity: "legendary",
    check: (s) => s.totalAura >= 1_000_000,
  },
];

export function getEarnedBadges(stats: UserStats): Badge[] {
  return BADGES.filter((b) => b.check(stats));
}

export function getLockedBadges(stats: UserStats): Badge[] {
  return BADGES.filter((b) => !b.check(stats));
}

export const RARITY_COLORS: Record<string, string> = {
  common: "text-zinc-400",
  rare: "text-blue-400",
  epic: "text-purple-400",
  legendary: "text-amber-400",
};

export const RARITY_BG: Record<string, string> = {
  common: "bg-zinc-500/10",
  rare: "bg-blue-500/10",
  epic: "bg-purple-500/10",
  legendary: "bg-amber-500/10 glow-gold",
};
