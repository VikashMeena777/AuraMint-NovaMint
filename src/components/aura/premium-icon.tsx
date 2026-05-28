"use client";

import { 
  Skull, 
  Ghost, 
  User, 
  Star, 
  Flame, 
  Medal, 
  Zap, 
  Crown, 
  Heart, 
  GraduationCap, 
  Briefcase, 
  Dumbbell, 
  PartyPopper, 
  Home, 
  Dices,
  Sparkles,
  HelpCircle,
  TrendingUp,
  Frown,
  Meh
} from "lucide-react";
import { cn } from "@/lib/utils";

export const emojiToLucide = {
  // Tiers
  "💀": { icon: Skull, color: "text-red-400" },
  "🗿": { icon: Ghost, color: "text-slate-400" },
  "😐": { icon: Meh, color: "text-violet-400" },
  "⭐": { icon: Star, color: "text-blue-400" },
  "🔥": { icon: Flame, color: "text-amber-400" },
  "👑": { icon: Crown, color: "text-yellow-400" },
  "⚡": { icon: Zap, color: "text-purple-400" },
  "🌟": { icon: Sparkles, color: "text-yellow-300 animate-pulse" },
  "✨": { icon: Sparkles, color: "text-accent animate-pulse" },
  "😬": { icon: Frown, color: "text-rose-400" },

  // Categories
  "💕": { icon: Heart, color: "text-pink-400" },
  "🎓": { icon: GraduationCap, color: "text-blue-400" },
  "💼": { icon: Briefcase, color: "text-amber-600" },
  "💪": { icon: Dumbbell, color: "text-emerald-400" },
  "🎉": { icon: PartyPopper, color: "text-rose-400" },
  "🏠": { icon: Home, color: "text-indigo-400" },
  "🎲": { icon: Dices, color: "text-teal-400" },
  "🎭": { icon: User, color: "text-pink-400" },
};

export function PremiumIcon({ 
  emoji, 
  className, 
  fallbackSize = "h-4 w-4" 
}: { 
  emoji: string; 
  className?: string;
  fallbackSize?: string;
}) {
  const cleanEmoji = emoji?.trim();
  const match = emojiToLucide[cleanEmoji as keyof typeof emojiToLucide];

  if (!match) {
    // If no match found, render the emoji as is, cleanly wrapped
    return <span className={cn("inline-block select-none", className)}>{emoji}</span>;
  }

  const IconComponent = match.icon;
  return <IconComponent className={cn("shrink-0", match.color, fallbackSize, className)} />;
}

export const tierLucideMeta = {
  "Negative Aura": { icon: Skull, color: "text-red-400", gradient: "from-red-950/40 via-red-900/20 to-red-950/40" },
  NPC: { icon: Ghost, color: "text-slate-400", gradient: "from-slate-900/40 via-slate-800/20 to-slate-900/40" },
  Civilian: { icon: Meh, color: "text-violet-400", gradient: "from-violet-950/40 via-violet-900/20 to-violet-950/40" },
  "Rising Star": { icon: Star, color: "text-blue-400", gradient: "from-blue-950/40 via-blue-900/20 to-blue-950/40" },
  "Main Character": { icon: Flame, color: "text-amber-400", gradient: "from-amber-950/40 via-amber-900/20 to-amber-950/40" },
  Legendary: { icon: Medal, color: "text-yellow-400", gradient: "from-yellow-950/40 via-yellow-900/20 to-yellow-950/40" },
  Mythical: { icon: Zap, color: "text-purple-400", gradient: "from-purple-950/40 via-purple-900/20 to-purple-950/40" },
  "GOD MODE": { icon: Crown, color: "text-yellow-400 font-extrabold animate-pulse", gradient: "from-amber-900/50 via-yellow-900/30 to-amber-900/50" },
};
