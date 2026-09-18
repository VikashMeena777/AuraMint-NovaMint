"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Trophy, Clock, CalendarDays, Infinity as InfinityIcon, Flame, Swords, RefreshCw, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLeaderboard } from "@/lib/actions/aura-actions";
import type { LeaderboardPeriod, LeaderboardUser } from "@/components/aura/types";
import { AuraNumber } from "@/components/aura/aura-number";
import { Chip, EmptyState, Plate, PrimaryButton } from "@/components/aura/primitives";
import { TierMark } from "@/components/aura/tier-mark";
import { useViewer } from "@/components/aura/hooks";
import { TONE } from "@/components/aura/mint";

const PERIODS: { key: LeaderboardPeriod; label: string; icon: typeof Clock }[] = [
  { key: "daily", label: "Today", icon: Clock },
  { key: "weekly", label: "This week", icon: CalendarDays },
  { key: "alltime", label: "All time", icon: InfinityIcon },
];

const MEDALS: Record<number, string> = {
  0: "text-[#8A6E14] dark:text-[#C9A227]",
  1: "text-[#6B7078] dark:text-[#B9BDC2]",
  2: "text-[#9E3A26] dark:text-[#D08B6C]",
};

const EMPTY_COPY: Record<LeaderboardPeriod, string> = {
  daily: "The day is fresh. Mint the first entry and take the top line.",
  weekly: "No entries this week yet. Start a streak and fill the page.",
  alltime: "The ledger is empty. Be the first name in it.",
};

export default function LeaderboardClient() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("alltime");
  const [state, setState] = useState<{ period: LeaderboardPeriod; users: LeaderboardUser[]; loaded: boolean }>({
    period: "alltime",
    users: [],
    loaded: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestSeq = useRef(0);
  const viewer = useViewer();
  const reducedMotion = useReducedMotion();

  const loading = !state.loaded || state.period !== period;

  // Loader lives inside the effect; the request id guards against a slower earlier
  // period overwriting a newer one.
  useEffect(() => {
    let cancelled = false;
    const id = ++requestSeq.current;
    async function run() {
      try {
        const res = (await getLeaderboard(period)) as { users?: LeaderboardUser[]; error?: string } | null;
        if (cancelled || id !== requestSeq.current) return;
        setState({ period, users: Array.isArray(res?.users) ? res.users : [], loaded: true });
        setError(res?.error ?? null);
      } catch {
        if (cancelled || id !== requestSeq.current) return;
        setError("Couldn't load the rankings. Retry in a moment.");
        setState((prev) => ({ ...prev, period, loaded: true }));
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [period, refreshKey]);

  const isPeriodAura = period !== "alltime";

  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl leading-none text-foreground">Ranked ledger</h1>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {isPeriodAura
            ? "Aura minted in this window — lifetime tier shown for context."
            : "Lifetime aura balances, struck under each holder's name."}
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Ranking period"
        className="mb-5 flex gap-1 rounded-xl border border-border/70 bg-secondary/20 p-1"
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          const i = PERIODS.findIndex((p) => p.key === period);
          const next = e.key === "ArrowRight" ? (i + 1) % PERIODS.length : (i - 1 + PERIODS.length) % PERIODS.length;
          setPeriod(PERIODS[next].key);
        }}
      >
        {PERIODS.map(({ key, label, icon: Icon }) => {
          const active = period === key;
          return (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => setPeriod(key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors",
                active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      <div className="space-y-2.5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Plate key={i} className="flex items-center gap-4 p-4">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                <div className="h-2.5 w-20 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-6 w-16 animate-pulse rounded bg-muted" />
            </Plate>
          ))
        ) : error ? (
          <Plate className="px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <PrimaryButton className="mt-4" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry
            </PrimaryButton>
          </Plate>
        ) : state.users.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-6 w-6" aria-hidden="true" />}
            title="No rankings yet"
            description={EMPTY_COPY[period]}
          />
        ) : (
          state.users.map((user, index) => {
            const name = user.display_name || user.username || "Anonymous";
            const username = user.username;
            const canDuel = Boolean(viewer.username && username && viewer.username !== username);
            return (
              <motion.div
                key={user.id}
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.28, delay: Math.min(index, 8) * 0.03 }}
              >
                <Plate
                  interactive={Boolean(username)}
                  className={cn(
                    "flex items-center justify-between gap-4 p-4",
                    index === 0 && "ring-1 ring-[#C9A227]/40"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-secondary/30 font-mono text-sm font-bold tabular-nums",
                        MEDALS[index] ?? "text-muted-foreground"
                      )}
                      aria-label={`Rank ${user.rank ?? index + 1}`}
                    >
                      {user.rank ?? index + 1}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {username ? (
                          <Link href={`/profile/${username}`} className="truncate text-sm font-semibold text-foreground hover:underline">
                            {name}
                          </Link>
                        ) : (
                          <span className="truncate text-sm font-semibold text-foreground">{name}</span>
                        )}
                        <TierMark tier={user.current_tier} size="sm" />
                        {user.is_premium ? (
                          <Crown className="h-3.5 w-3.5 text-[#C9A227]" aria-label="Premium member" />
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        {username ? <span className="truncate">@{username}</span> : null}
                        {user.streak_days && user.streak_days > 0 ? (
                          <span className="inline-flex items-center gap-0.5">
                            <Flame className="h-3 w-3 text-[#B4442E] dark:text-[#E0795F]" aria-hidden="true" />
                            {user.streak_days}d
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3 text-right">
                    <div>
                      <AuraNumber value={user.total_aura} size="md" signed={false} />
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {isPeriodAura ? "this period" : "lifetime"}
                      </p>
                    </div>
                    {canDuel ? (
                      <Chip tone="lead" className="hidden sm:inline-flex">
                        <Link href={`/vs/${viewer.username}/${username}`} className="inline-flex items-center gap-1.5">
                          <Swords className="h-3 w-3" aria-hidden="true" />
                          Duel
                        </Link>
                      </Chip>
                    ) : null}
                  </div>
                </Plate>
              </motion.div>
            );
          })
        )}
      </div>

      {!loading && state.users.length > 0 ? (
        <p className={cn("mt-5 text-center text-[10px] uppercase tracking-[0.14em]", TONE.leadText)}>
          Showing top {state.users.length}
        </p>
      ) : null}
    </div>
  );
}
