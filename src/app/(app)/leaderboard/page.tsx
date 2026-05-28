"use client";

import { useState, useEffect } from "react";
import { getLeaderboard } from "@/lib/actions/aura-actions";
import { cn, formatAuraPoints } from "@/lib/utils";
import { motion } from "framer-motion";
import { Trophy, Crown, Flame, Medal } from "lucide-react";

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
    <>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="h-7 w-7 text-primary" />
          <h1 className="heading text-2xl">
            Leaderboard
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Top aura holders across the universe
        </p>
      </div>

      {/* Period Tabs */}
      <div className="mb-6 flex gap-1 rounded-2xl bg-secondary/50 p-1">
        {(["daily", "weekly", "alltime"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "flex-1 rounded-xl px-4 py-2.5 text-sm font-medium capitalize transition-all",
              period === p
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p === "alltime" ? "All Time" : p}
          </button>
        ))}
      </div>

      {/* Leaderboard List */}
      <div className="space-y-2">
        {loading
          ? Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="glass flex animate-pulse items-center gap-4 p-4">
                <div className="h-8 w-8 rounded-full bg-secondary" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-32 rounded bg-secondary" />
                  <div className="h-3 w-20 rounded bg-secondary" />
                </div>
                <div className="h-5 w-16 rounded bg-secondary" />
              </div>
            ))
          : users.length === 0
          ? (
            <div className="flex flex-col items-center py-20 text-center">
              <Trophy className="mb-4 h-16 w-16 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold">No rankings yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Be the first to claim the throne! Start logging aura events.
              </p>
            </div>
          )
          : users.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className={cn(
                  "glass flex items-center gap-4 p-4 transition-all hover:bg-card/80",
                  index === 0 && "glow-gold border-primary/20",
                  index === 1 && "border-gray-400/20",
                  index === 2 && "border-amber-700/20"
                )}
              >
                {/* Rank */}
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                    index < 3
                      ? "bg-primary/10 text-2xl"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  {index < 3 ? rankBadges[index] : `#${user.rank}`}
                </div>

                {/* Avatar + Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {(user.display_name || user.username).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {user.display_name || user.username}
                        <span className="ml-1">
                          {tierEmojis[user.current_tier] || "🗿"}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        @{user.username}
                        {user.streak_days > 0 && (
                          <span className="ml-2">
                            <Flame className="inline h-3 w-3 text-orange-500" />{" "}
                            {user.streak_days}d
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Aura Score */}
                <div className="text-right">
                  <p
                    className={cn(
                      "mono text-lg font-bold",
                      user.total_aura >= 0 ? "text-emerald-500" : "text-red-500"
                    )}
                  >
                    {formatAuraPoints(user.total_aura)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {user.current_tier}
                  </p>
                </div>
              </motion.div>
            ))}
      </div>
    </>
  );
}
