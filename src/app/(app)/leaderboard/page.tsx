"use client";

import { useState, useEffect } from "react";
import { getLeaderboard } from "@/lib/actions/aura-actions";
import { cn, formatAuraPoints } from "@/lib/utils";
import { motion } from "framer-motion";
import { Trophy, Clock, CalendarDays, Infinity, Flame } from "lucide-react";
import { PremiumIcon } from "@/components/aura/premium-icon";

const tierEmojis: Record<string, string> = {
  "Negative Aura": "💀", NPC: "🗿", Civilian: "😐", "Rising Star": "⭐",
  "Main Character": "🔥", Legendary: "👑", Mythical: "⚡", "GOD MODE": "🌟",
};

const rankBadges = ["🥇", "🥈", "🥉"];

type Period = "daily" | "weekly" | "alltime";

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>("alltime");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const result = await getLeaderboard(period);
      setUsers(result.users);
      setLoading(false);
    }
    load();
  }, [period]);

  return (
    <div className="mx-auto max-w-xl">
      {/* Header Title Section */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 border border-primary/5 shadow-sm">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <h1 className="heading text-3xl tracking-tight leading-none">
              Leaderboard
            </h1>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Top aura holders across the multiverse
          </p>
        </div>
      </div>

      {/* Segment Period Selector Tabs */}
      <div className="mb-6 flex gap-1 rounded-2xl bg-secondary/30 p-1 border border-border/20 backdrop-blur-md">
        {([
          { key: "daily" as Period, label: "Today", icon: Clock },
          { key: "weekly" as Period, label: "This Week", icon: CalendarDays },
          { key: "alltime" as Period, label: "All Time", icon: Infinity },
        ]).map(({ key, label, icon: Icon }) => {
          const isActive = period === key;
          return (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all",
                isActive
                  ? "bg-card text-primary shadow-sm border border-border/30"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Leaderboard Table Rankings List */}
      <div className="space-y-3">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="glass flex animate-pulse items-center gap-4 p-5 rounded-3xl border border-border/30">
                <div className="h-10 w-10 rounded-2xl bg-secondary/70" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-32 rounded bg-secondary/60" />
                  <div className="h-2.5 w-20 rounded bg-secondary/40" />
                </div>
                <div className="h-6 w-16 rounded bg-secondary/50" />
              </div>
            ))
          : users.length === 0
          ? (
            <div className="glass noise flex flex-col items-center py-20 text-center rounded-3xl border border-border/30">
              <Trophy className="mb-4 h-14 w-14 text-muted-foreground/35 animate-pulse" />
              <h3 className="heading text-xl">No Rankings Yet</h3>
              <p className="mt-2 max-w-sm text-xs sm:text-sm text-muted-foreground leading-relaxed px-4">
                {period === "daily"
                  ? "The day is fresh! Be the first to log an aura event and claim the top spot."
                  : period === "weekly"
                  ? "No points recorded yet this week. Fire up your streaks and start logging!"
                  : "The arena is completely vacant. Establish your rule by logging moments now."}
              </p>
            </div>
          )
          : users.map((user, index) => {
              const isTopThree = index < 3;
              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04, ease: "easeOut" }}
                  className={cn(
                    "glass noise flex items-center justify-between gap-4 p-4.5 rounded-3xl transition-all border",
                    index === 0 && "glow-gold border-primary/20 bg-gradient-to-r from-primary/5 to-transparent",
                    index === 1 && "border-slate-400/25 bg-gradient-to-r from-slate-500/5 to-transparent",
                    index === 2 && "border-amber-700/25 bg-gradient-to-r from-amber-700/5 to-transparent",
                    index > 2 && "border-border/30 hover:border-primary/10"
                  )}
                >
                  {/* Rank Display indicator */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xs font-black shadow-inner",
                        isTopThree
                          ? "bg-primary/10 text-2xl border border-primary/5"
                          : "bg-secondary/40 text-muted-foreground/80 border border-transparent"
                      )}
                    >
                      {index < 3 ? rankBadges[index] : `#${user.rank}`}
                    </div>

                    {/* User profile detail pill */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/5 text-xs font-black text-primary">
                          {(user.display_name || user.username).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold leading-tight flex items-center gap-1.5">
                            <span>{user.display_name || user.username}</span>
                            <PremiumIcon emoji={tierEmojis[user.current_tier]} className="h-3.5 w-3.5" />
                          </p>
                          <p className="truncate text-[10px] font-semibold text-muted-foreground/60 mt-0.5 flex items-center gap-2">
                            <span>@{user.username}</span>
                            {user.streak_days > 0 && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/10 px-2 py-0.5 text-[9px] font-extrabold text-orange-400 border border-orange-500/10">
                                <Flame className="h-2.5 w-2.5" />
                                {user.streak_days}d
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Aura points balance display */}
                  <div className="text-right shrink-0">
                    <p
                      className={cn(
                        "heading text-base sm:text-lg font-extrabold leading-none tracking-tight",
                        user.total_aura >= 0 ? "text-emerald-400" : "text-red-400"
                      )}
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {user.total_aura >= 0 ? "+" : ""}
                      {formatAuraPoints(user.total_aura)}
                    </p>
                    <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground/50 mt-1">
                      {user.current_tier}
                    </p>
                  </div>
                </motion.div>
              );
            })}
      </div>
    </div>
  );
}
