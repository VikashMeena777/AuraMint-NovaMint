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
import { cn } from "@/lib/utils";
import { PremiumIcon } from "@/components/aura/premium-icon";

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
      <div className="mx-auto max-w-xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 border border-primary/5 shadow-sm">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <h1 className="heading text-2xl">Badges</h1>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass animate-pulse p-6 rounded-3xl border border-border/30">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-muted/60" />
              <div className="mx-auto mt-4 h-3.5 w-24 rounded bg-muted/50" />
              <div className="mx-auto mt-2 h-2.5 w-16 rounded bg-muted/30" />
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
    <div className="mx-auto max-w-xl">
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 border border-primary/5 shadow-sm">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <h1 className="heading text-3xl tracking-tight leading-none">Badges</h1>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {earned.length}/{BADGES.length} Unlocked — keep logging events to unlock rare achievements!
          </p>
        </div>
      </div>

      {/* Rarity progress bar */}
      <div className="mb-8">
        <div className="h-2.5 overflow-hidden rounded-full bg-secondary border border-border/10 p-0.5">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
            initial={{ width: 0 }}
            animate={{ width: `${(earned.length / BADGES.length) * 100}%` }}
            transition={{ duration: 1.2, delay: 0.25, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Unlocked Badges Panel Grid */}
      {earned.length > 0 && (
        <div className="mb-8">
          <h2 className="heading mb-4 text-xs font-extrabold uppercase tracking-widest text-emerald-400">
            ✅ Unlocked Achievements ({earned.length})
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {earned.map((badge, i) => {
              const isLegendary = badge.rarity === "legendary";
              return (
                <motion.div
                  key={badge.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05, ease: "easeOut" }}
                  className={cn(
                    "rounded-3xl h-full overflow-hidden",
                    isLegendary && "border-holographic p-[1px] glow-gold"
                  )}
                >
                  <div
                    className={cn(
                      "glass noise relative overflow-hidden p-5 text-center border rounded-3xl h-full flex flex-col justify-between",
                      RARITY_BG[badge.rarity],
                      isLegendary ? "border-transparent bg-card/90" : "border-border/30",
                      badge.rarity === "epic" && "border-purple-500/20"
                    )}
                  >
                    {/* Visual sparkles on rare elements */}
                    {isLegendary && (
                      <div className="absolute -right-6 -top-6 h-12 w-12 rounded-full bg-yellow-400/10 blur-md pointer-events-none" />
                    )}
                    
                    <div className="relative z-10 flex flex-col items-center">
                      <PremiumIcon emoji={badge.emoji} className="h-10 w-10 animate-bounce mb-3" />
                      <p className="text-xs font-bold leading-tight text-foreground">{badge.name}</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/80 min-h-[32px]">{badge.description}</p>
                      <span className={cn(
                        "mt-3 inline-block text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full border bg-card/45",
                        RARITY_COLORS[badge.rarity]
                      )}>
                        {badge.rarity}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Locked Achievements Panel Grid */}
      {locked.length > 0 && (
        <div>
          <h2 className="heading mb-4 text-xs font-extrabold uppercase tracking-widest text-muted-foreground/60">
            🔒 Locked Achievements ({locked.length})
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {locked.map((badge, i) => (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + i * 0.04, ease: "easeOut" }}
                className="glass relative overflow-hidden p-5 text-center border border-border/30 rounded-3xl opacity-55"
              >
                <div className="relative z-10">
                  <div className="relative mx-auto w-fit mb-3">
                    <PremiumIcon emoji={badge.emoji} className="h-10 w-10 grayscale" />
                    <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-card rounded-full border border-border flex items-center justify-center shadow-sm">
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </div>
                  <p className="text-xs font-bold leading-tight text-muted-foreground">{badge.name}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/60 min-h-[32px]">{badge.requirement}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
