import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format large numbers with K/M suffix
 */
export function formatAuraPoints(points: number): string {
  const abs = Math.abs(points);
  const sign = points >= 0 ? "+" : "";

  if (abs >= 1_000_000) {
    return `${sign}${(points / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${(points / 1_000).toFixed(1)}K`;
  }
  return `${sign}${points}`;
}

/**
 * Format relative time (e.g., "2h ago", "just now")
 */
export function timeAgo(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

/**
 * Generate a random anonymous username
 */
export function generateUsername(): string {
  const adjectives = ["Cosmic", "Mystic", "Spicy", "Golden", "Shadow", "Neon", "Chill", "Savage", "Epic", "Sigma", "Based", "Vibe", "Chaos", "Astral", "Fire"];
  const nouns = ["Minter", "Aura", "Energy", "Phoenix", "Dragon", "Wolf", "Spirit", "Spark", "Flash", "Storm", "Flame", "Star", "Nova", "Blaze", "Pulse"];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 999);
  return `${adj}${noun}_${num}`;
}
