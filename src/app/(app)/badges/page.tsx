"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  BADGES,
  getEarnedBadges,
  getLockedBadges,
  RARITY_COLORS,
  RARITY_BG,
  type UserStats,
} from "@/lib/badges";
import { cn, formatAuraPoints } from "@/lib/utils";

export default function BadgesPage() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("total_aura, current_tier, streak_days, is_premium, created_at")
        .eq("id", user.id)
        .single();

      const { data: events } = await supabase
        .from("aura_events")
        .select("aura_points")
        .eq("user_id", user.id);

      const p = profile as any;
      const evts = (events || []) as any[];
      const points = evts.map((e) => e.aura_points);

      const daysActive = p?.created_at
        ? Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000)
        : 0;

      setStats({
        totalAura: p?.total_aura ?? 0,
        totalEvents: evts.length,
        streakDays: p?.streak_days ?? 0,
        biggestW: points.length > 0 ? Math.max(...points) : 0,
        biggestL: points.length > 0 ? Math.min(...points) : 0,
        tier: p?.current_tier ?? "NPC",
        isPremium: p?.is_premium ?? false,
        daysActive,
      });
      setLoading(false);
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Trophy className="h-7 w-7 text-primary" />
          <h1 className="heading text-2xl">Badges</h1>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass animate-pulse p-5">
              <div className="mx-auto h-10 w-10 rounded-full bg-muted" />
              <div className="mx-auto mt-3 h-3 w-20 rounded bg-muted" />
              <div className="mx-auto mt-2 h-2.5 w-16 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const earned = getEarnedBadges(stats);
  const locked = getLockedBadges(stats);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="h-7 w-7 text-primary" />
          <h1 className="heading text-2xl">Badges</h1>
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {earned.length}/{BADGES.length} unlocked — keep grinding!
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
            initial={{ width: 0 }}
            animate={{ width: `${(earned.length / BADGES.length) * 100}%` }}
            transition={{ duration: 1, delay: 0.3 }}
          />
        </div>
      </div>

      {/* Earned */}
      {earned.length > 0 && (
        <div className="mb-8">
          <h2 className="heading mb-3 text-sm text-emerald-400">
            ✅ Unlocked ({earned.length})
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {earned.map((badge, i) => (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={cn("glass noise relative overflow-hidden p-4 text-center", RARITY_BG[badge.rarity])}
              >
                <div className="relative z-10">
                  <span className="text-3xl">{badge.emoji}</span>
                  <p className="mt-2 text-[12px] font-semibold">{badge.name}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{badge.description}</p>
                  <span className={cn("mt-2 inline-block text-[9px] font-bold uppercase tracking-wider", RARITY_COLORS[badge.rarity])}>
                    {badge.rarity}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Locked */}
      {locked.length > 0 && (
        <div>
          <h2 className="heading mb-3 text-sm text-muted-foreground">
            🔒 Locked ({locked.length})
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {locked.map((badge, i) => (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.03 }}
                className="glass relative overflow-hidden p-4 text-center opacity-50"
              >
                <div className="relative z-10">
                  <div className="relative mx-auto w-fit">
                    <span className="text-3xl grayscale">{badge.emoji}</span>
                    <Lock className="absolute -bottom-0.5 -right-1 h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <p className="mt-2 text-[12px] font-semibold">{badge.name}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{badge.requirement}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
