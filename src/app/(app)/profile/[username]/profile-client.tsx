"use client";

import { motion } from "framer-motion";
import { Flame, Calendar, TrendingUp, TrendingDown, Trophy, Sparkles } from "lucide-react";
import { formatAuraPoints, timeAgo } from "@/lib/utils";
import { AuraEventCard } from "@/components/aura/aura-event-card";
import { getTierForAura, getTierProgress } from "@/lib/ai/prompts";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

const tierEmojis: Record<string, string> = {
  "Negative Aura": "💀", NPC: "🗿", Civilian: "😐", "Rising Star": "⭐",
  "Main Character": "🔥", Legendary: "👑", Mythical: "⚡", "GOD MODE": "🌟",
};

export function ProfileClient({
  profile,
  events,
  history,
}: {
  profile: any;
  events: any[];
  history: any[];
}) {
  const tier = getTierForAura(profile.total_aura);
  const progress = getTierProgress(profile.total_aura);

  // Build chart data — cumulative aura over time
  let cumulative = 0;
  const chartData = history.map((h: any) => {
    cumulative += h.aura_points;
    const date = new Date(h.created_at);
    return {
      date: `${date.getDate()}/${date.getMonth() + 1}`,
      aura: cumulative,
    };
  });

  // Stats
  const biggestW = events.length > 0
    ? Math.max(...events.map((e: any) => e.aura_points))
    : 0;
  const biggestL = events.length > 0
    ? Math.min(...events.map((e: any) => e.aura_points))
    : 0;

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass overflow-hidden"
      >
        {/* Banner gradient */}
        <div className="h-24 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20" />

        <div className="px-6 pb-6">
          {/* Avatar */}
          <div className="-mt-10 mb-4 flex items-end gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-card bg-primary/10 text-3xl font-bold text-primary shadow-lg">
              {(profile.display_name || profile.username).charAt(0).toUpperCase()}
            </div>
            <div className="pb-1">
              <h1 className="heading text-xl font-bold">
                {profile.display_name || profile.username}
              </h1>
              <p className="text-sm text-muted-foreground">
                @{profile.username}
              </p>
            </div>
          </div>

          {/* Aura + Tier */}
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Total Aura
              </p>
              <p className="mono text-3xl font-black tracking-tight text-primary">
                {formatAuraPoints(profile.total_aura)}
              </p>
            </div>

            <div className="rounded-xl bg-primary/10 px-4 py-2">
              <span className="text-2xl">{tierEmojis[tier.name]}</span>
              <span className="ml-2 text-sm font-semibold">{tier.name}</span>
            </div>

            {profile.streak_days > 0 && (
              <div className="flex items-center gap-1.5 rounded-xl bg-orange-500/10 px-3 py-2 text-sm font-medium text-orange-500">
                <Flame className="h-4 w-4" />
                {profile.streak_days} day streak
              </div>
            )}

            {profile.is_premium && (
              <span className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-bold text-primary">
                ✨ PRO
              </span>
            )}
          </div>

          {/* Tier Progress Bar */}
          {progress.next && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {tier.emoji} {tier.name}
                </span>
                <span>
                  {progress.next.emoji} {progress.next.name} ({formatAuraPoints(progress.remaining)} to go)
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.progress}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                />
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Events", value: events.length, icon: Calendar },
          { label: "Biggest W", value: formatAuraPoints(biggestW), icon: TrendingUp, color: "text-emerald-500" },
          { label: "Biggest L", value: formatAuraPoints(biggestL), icon: TrendingDown, color: "text-red-500" },
          { label: "Streak", value: `${profile.streak_days}d`, icon: Flame, color: "text-orange-500" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="glass p-4"
          >
            <stat.icon className={`h-4 w-4 ${stat.color || "text-muted-foreground"} mb-2`} />
            <p className={`mono text-lg font-bold ${stat.color || ""}`}>
              {stat.value}
            </p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Aura History Chart */}
      {chartData.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass p-6"
        >
          <h2 className="mb-4 heading text-lg font-semibold">
            Aura Journey 📈
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="auraGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="aura"
                stroke="hsl(38, 92%, 50%)"
                strokeWidth={2}
                fill="url(#auraGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Recent Events */}
      <div>
        <h2 className="mb-4 heading text-lg font-semibold">
          Recent Events
        </h2>
        {events.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Sparkles className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No events yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event, i) => (
              <AuraEventCard key={event.id} event={event} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
