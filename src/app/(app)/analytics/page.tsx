"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Zap, Target, Flame, Trophy,
  BarChart3, ArrowUpRight, ArrowDownRight, Rocket, Lock, Crown,
} from "lucide-react";
import { cn, formatAuraPoints } from "@/lib/utils";
import { getAnalyticsData } from "@/lib/actions/aura-actions";
import { CATEGORIES } from "@/lib/ai/prompts";
import { PremiumIcon } from "@/components/aura/premium-icon";

type AnalyticsResult = Awaited<ReturnType<typeof getAnalyticsData>>;

const categoryColors: Record<string, string> = {
  crush: "#f43f5e",
  school: "#3b82f6",
  work: "#8b5cf6",
  gym: "#10b981",
  social: "#f59e0b",
  family: "#ec4899",
  random: "#6366f1",
};

const categoryEmojis: Record<string, string> = {
  crush: "💘",
  school: "📚",
  work: "💼",
  gym: "💪",
  social: "🎉",
  family: "🏠",
  random: "🎲",
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const result = await getAnalyticsData();
      setData(result as AnalyticsResult);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <div className="glass-card rounded-2xl p-8 animate-pulse">
          <div className="h-6 w-48 bg-muted rounded mb-4" />
          <div className="h-40 bg-muted/50 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl p-6 animate-pulse">
              <div className="h-4 w-20 bg-muted rounded mb-3" />
              <div className="h-8 w-24 bg-muted/50 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || "error" in data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-card rounded-2xl p-12 text-center max-w-sm">
          <Lock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="heading text-xl mb-2">Unable to load analytics</h2>
          <p className="text-sm text-muted-foreground">Please log in to view your aura insights.</p>
        </div>
      </div>
    );
  }

  if ("isEmpty" in data && data.isEmpty) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-12 text-center max-w-sm"
        >
          <BarChart3 className="h-12 w-12 text-primary/40 mx-auto mb-4" />
          <h2 className="heading text-xl mb-2">No Data Yet</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Start logging aura events from the Feed to see your analytics come alive here.
          </p>
        </motion.div>
      </div>
    );
  }

  const { stats, dailyTrend, categoryBreakdown, vibeDistribution, highlights, profile } = data as any;

  // Find max values for chart scaling
  const maxDailyNet = Math.max(...dailyTrend.map((d: any) => Math.abs(d.net)), 1);
  const maxCategoryCount = Math.max(...categoryBreakdown.map((c: any) => c.count), 1);
  const maxVibeCount = Math.max(...(vibeDistribution || []).map((v: any) => v.count), 1);

  const statCards = [
    { label: "Total Events", value: stats.totalEvents, icon: Zap, color: "text-primary" },
    { label: "Win Rate", value: `${stats.winRate}%`, icon: Target, color: stats.winRate >= 50 ? "text-emerald-500" : "text-red-400" },
    { label: "Net Aura", value: formatAuraPoints(stats.netAura), icon: stats.netAura >= 0 ? TrendingUp : TrendingDown, color: stats.netAura >= 0 ? "text-emerald-500" : "text-red-400" },
    { label: "Avg Points", value: formatAuraPoints(stats.avgPoints), icon: Flame, color: stats.avgPoints >= 0 ? "text-amber-500" : "text-red-400" },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-5xl mx-auto">
      {/* ═══ Header ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="heading text-2xl sm:text-3xl tracking-tight flex items-center gap-3">
            <BarChart3 className="h-7 w-7 text-primary" />
            Aura Analytics
          </h1>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest font-bold">
            Your cosmic performance dashboard
          </p>
        </div>
        {profile?.is_premium && (
          <span className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-3 py-1">
            <PremiumIcon emoji="✨" className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Premium</span>
          </span>
        )}
      </motion.div>

      {/* ═══ Stat Cards ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card rounded-2xl p-4 sm:p-5 group hover:border-primary/20 transition-all"
          >
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={cn("h-4 w-4", s.color)} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{s.label}</span>
            </div>
            <p className={cn("text-xl sm:text-2xl font-black mono", s.color)}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* ═══ Win / Loss Split ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card rounded-2xl p-5 sm:p-6"
      >
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Win / Loss Breakdown</h3>
        <div className="flex gap-4 items-center">
          {/* Win bar */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
                <ArrowUpRight className="h-3.5 w-3.5" /> {stats.totalWins} Wins
              </span>
              <span className="mono text-xs text-emerald-500">+{formatAuraPoints(stats.totalGain)}</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${stats.winRate}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
              />
            </div>
          </div>
          <div className="text-xs font-black text-muted-foreground">vs</div>
          {/* Loss bar */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                <ArrowDownRight className="h-3.5 w-3.5" /> {stats.totalLosses} Losses
              </span>
              <span className="mono text-xs text-red-400">-{formatAuraPoints(stats.totalLoss)}</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${100 - stats.winRate}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══ 30-Day Trend Chart ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card rounded-2xl p-5 sm:p-6"
      >
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5">30-Day Aura Trend</h3>
        <div className="flex items-end gap-[2px] sm:gap-1 h-40">
          {dailyTrend.map((day: any, i: number) => {
            const absNet = Math.abs(day.net);
            const heightPct = maxDailyNet > 0 ? (absNet / maxDailyNet) * 100 : 0;
            const isPositive = day.net >= 0;
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                {/* Tooltip */}
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 glass-card px-2.5 py-1.5 rounded-lg text-[9px] opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none">
                  <p className="font-bold">{day.label}</p>
                  <p className={isPositive ? "text-emerald-500" : "text-red-400"}>
                    {isPositive ? "+" : "-"}{formatAuraPoints(absNet)} ({day.count} events)
                  </p>
                </div>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(heightPct, 3)}%` }}
                  transition={{ duration: 0.5, delay: i * 0.01 }}
                  className={cn(
                    "w-full rounded-t-sm min-h-[2px] transition-all",
                    isPositive
                      ? "bg-emerald-500/60 group-hover:bg-emerald-500"
                      : day.net === 0
                        ? "bg-muted-foreground/20"
                        : "bg-red-400/60 group-hover:bg-red-400"
                  )}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[9px] text-muted-foreground/50 font-bold">30 days ago</span>
          <span className="text-[9px] text-muted-foreground/50 font-bold">Today</span>
        </div>
      </motion.div>

      {/* ═══ Two-Column: Categories + Vibes ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Category Breakdown */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card rounded-2xl p-5 sm:p-6"
        >
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Category Breakdown</h3>
          <div className="space-y-3">
            {categoryBreakdown.map((cat: any) => {
              const pct = (cat.count / maxCategoryCount) * 100;
              const catInfo = CATEGORIES.find(c => c.value === cat.category);
              return (
                <div key={cat.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-2 text-xs font-bold">
                      <span>{categoryEmojis[cat.category] || "🎲"}</span>
                      <span className="capitalize">{catInfo?.label || cat.category}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{cat.count} events</span>
                      <span className={cn("mono text-[10px] font-bold", cat.total >= 0 ? "text-emerald-500" : "text-red-400")}>
                        {cat.total >= 0 ? "+" : ""}{formatAuraPoints(cat.total)}
                      </span>
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, delay: 0.1 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: categoryColors[cat.category] || "#6366f1" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Vibe Tags */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card rounded-2xl p-5 sm:p-6"
        >
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Top Vibe Tags</h3>
          {vibeDistribution && vibeDistribution.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {vibeDistribution.map((vibe: any, i: number) => {
                const opacity = 0.4 + (vibe.count / maxVibeCount) * 0.6;
                return (
                  <motion.span
                    key={vibe.tag}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + i * 0.05 }}
                    className="glass-card px-3 py-1.5 rounded-full text-xs font-bold border border-primary/20"
                    style={{ opacity }}
                  >
                    {vibe.tag} <span className="text-muted-foreground ml-1">×{vibe.count}</span>
                  </motion.span>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/50">No vibe tags recorded yet.</p>
          )}

          {/* Boost Status */}
          {profile?.is_premium && (
            <div className="mt-6 pt-4 border-t border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <Rocket className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Boost Stats</span>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-lg font-black mono text-primary">{profile.boosts_remaining || 0}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">Boosts left</p>
                </div>
                <div>
                  <p className="text-lg font-black mono">{stats.boostedCount}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">Boosted total</p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ═══ Highlights ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4"
      >
        {/* Best Win */}
        {highlights?.topWin && (
          <div className="glass-card rounded-2xl p-5 border-emerald-500/10 hover:border-emerald-500/30 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Biggest W</span>
            </div>
            <p className="text-xs leading-relaxed line-clamp-2 mb-2">{highlights.topWin.description}</p>
            <p className="mono text-sm font-black text-emerald-500">+{formatAuraPoints(highlights.topWin.points)}</p>
          </div>
        )}

        {/* Worst Loss */}
        {highlights?.topLoss && (
          <div className="glass-card rounded-2xl p-5 border-red-500/10 hover:border-red-500/30 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="h-4 w-4 text-red-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">Biggest L</span>
            </div>
            <p className="text-xs leading-relaxed line-clamp-2 mb-2">{highlights.topLoss.description}</p>
            <p className="mono text-sm font-black text-red-400">{formatAuraPoints(highlights.topLoss.points)}</p>
          </div>
        )}

        {/* Most Voted */}
        {highlights?.mostVoted && (
          <div className="glass-card rounded-2xl p-5 border-primary/10 hover:border-primary/30 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <Crown className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Most Popular</span>
            </div>
            <p className="text-xs leading-relaxed line-clamp-2 mb-2">{highlights.mostVoted.description}</p>
            <p className="mono text-sm font-black text-primary">{highlights.mostVoted.upvotes} upvotes</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
