"use client";

import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Crown,
  Flame,
  Lock,
  Rocket,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { getAnalyticsData } from "@/lib/actions/aura-actions";
import { AuraNumber } from "@/components/aura/aura-number";
import { AnimatedIcon } from "@/components/ui/animated-icon";
import {
  Chip,
  EmptyState,
  Plate,
  PrimaryButton,
  SectionLabel,
  SkeletonPlate,
} from "@/components/aura/primitives";
import { categoryMeta, formatSignedAura, TONE } from "@/components/aura/mint";

type AnalyticsResult = Awaited<ReturnType<typeof getAnalyticsData>>;
type Polarity = "positive" | "negative" | "neutral";

const auraFigures = new Intl.NumberFormat("en-IN");

/**
 * Zero is its own polarity: a day that netted nothing must not inherit the win
 * treatment. Every call site reads polarity from here so "net >= 0 is positive"
 * cannot come back.
 */
function trendPolarity(net: number): Polarity {
  if (net > 0) return "positive";
  if (net < 0) return "negative";
  return "neutral";
}

/** Spoken day summary — used for the focusable bar's accessible name. */
function dayAriaLabel(label: string, net: number, count: number): string {
  const events = `${count} event${count === 1 ? "" : "s"}`;
  if (count === 0) return `${label}: no events logged`;
  if (net > 0) return `${label}: gain of ${auraFigures.format(net)} aura, ${events}`;
  if (net < 0) return `${label}: loss of ${auraFigures.format(Math.abs(net))} aura, ${events}`;
  return `${label}: no net change, ${events}`;
}

/** Visual day summary for the readout under the chart. */
function dayReadout(label: string, net: number, count: number): string {
  if (count === 0) return `${label} — no events logged`;
  const events = `${count} event${count === 1 ? "" : "s"}`;
  if (net === 0) return `${label} — 0 net across ${events}`;
  return `${label} — ${formatSignedAura(net)} aura across ${events}`;
}

/** Trend fills carry polarity; volume fills carry magnitude only. */
const TREND_FILL: Record<Polarity, string> = {
  positive: "bg-[#1F6F5C] group-hover:bg-[#2E9E7A]",
  negative: "bg-[#B4442E] group-hover:bg-[#E0795F]",
  neutral: "bg-[#7A7F87]/40 group-hover:bg-[#7A7F87]/60",
};
const TREND_TEXT: Record<Polarity, string> = {
  positive: TONE.posText,
  negative: TONE.negText,
  neutral: TONE.leadText,
};

/** Category bars encode how many, never which way: third hue, data-viz fills only. */
const VOLUME_FILL = "bg-[#1B3A5C]/85 dark:bg-[#5C8DB5]/80";

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [hoveredStat, setHoveredStat] = useState<number | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const reducedMotion = Boolean(useReducedMotion());

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await getAnalyticsData();
        if (active) setData(result);
      } catch {
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <SkeletonPlate className="h-40 p-8" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonPlate key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || "error" in data) {
    return (
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <EmptyState
          icon={<Lock className="h-6 w-6" aria-hidden="true" />}
          title="Analytics unavailable"
          description={
            loadError
              ? "We could not reach your ledger. Try again in a moment."
              : data && "error" in data
                ? data.error
                : "Your analytics are unavailable right now."
          }
          action={
            <PrimaryButton onClick={() => window.location.reload()}>
              Try again
            </PrimaryButton>
          }
        />
      </div>
    );
  }

  if ("isEmpty" in data && data.isEmpty) {
    return (
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" aria-hidden="true" />}
          title="Nothing on the ledger yet"
          description="Log your first aura event from the Feed and the assay room will fill in: daily trend, category breakdown and your biggest win."
        />
      </div>
    );
  }

  const { stats, dailyTrend, categoryBreakdown, vibeDistribution, highlights, profile } = data;

  // A win share needs a scored outcome to divide by; zero-point-only ledgers have none.
  const scoredOutcomes = stats.totalWins + stats.totalLosses;
  const hasScored = stats.totalGain > 0 || stats.totalLoss > 0;

  // Shares come from the same counts the labels print, never from a separate rate.
  const winShare = hasScored ? (stats.totalWins / scoredOutcomes) * 100 : 0;
  const lossShare = hasScored ? (stats.totalLosses / scoredOutcomes) * 100 : 0;

  const maxDailyNet = Math.max(...dailyTrend.map((d) => Math.abs(d.net)), 1);
  const maxCategoryCount = Math.max(...categoryBreakdown.map((c) => c.count), 1);
  const maxVibeCount = Math.max(...(vibeDistribution || []).map((v) => v.count), 1);

  const netPolarity = trendPolarity(stats.netAura);
  const netIcon = netPolarity === "positive" ? TrendingUp : netPolarity === "negative" ? TrendingDown : Activity;
  const avgIcon = trendPolarity(stats.avgPoints) === "negative" ? TrendingDown : Flame;
  const activePoint = dailyTrend.find((d) => d.date === activeDay) ?? null;

  const statCards = [
    {
      label: "Total events",
      icon: Zap,
      idiom: "press" as const,
      iconTone: "text-foreground",
      node: <span className="mono text-[20px] font-semibold tabular-nums">{stats.totalEvents}</span>,
    },
    {
      label: "Win rate",
      icon: Target,
      idiom: "press" as const,
      iconTone: !hasScored ? TONE.leadText : stats.winRate >= 50 ? TONE.posText : TONE.negText,
      node: (
        <span
          className={cn(
            "mono text-[20px] font-semibold tabular-nums",
            !hasScored ? TONE.leadText : stats.winRate >= 50 ? TONE.posText : TONE.negText
          )}
        >
          {hasScored ? `${stats.winRate}%` : "\u2014"}
        </span>
      ),
    },
    {
      label: "Net aura",
      icon: netIcon,
      idiom: "strike" as const,
      iconTone: TREND_TEXT[netPolarity],
      node: (
        <AuraNumber
          value={stats.netAura}
          size="md"
          colorClassName={netPolarity === "neutral" ? "text-muted-foreground" : undefined}
        />
      ),
    },
    {
      label: "Avg points",
      icon: avgIcon,
      idiom: "strike" as const,
      iconTone: TREND_TEXT[trendPolarity(stats.avgPoints)],
      node: (
        <AuraNumber
          value={stats.avgPoints}
          size="md"
          colorClassName={stats.avgPoints === 0 ? "text-muted-foreground" : undefined}
        />
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <motion.header
        initial={reducedMotion ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.32, ease: "easeOut" }}
        className="flex flex-wrap items-start justify-between gap-3"
      >
        <div>
          <h1 className="font-display flex items-center gap-3 text-3xl leading-none text-foreground">
            <AnimatedIcon icon={BarChart3} idiom="strike" className="h-7 w-7 text-[#1F6F5C] dark:text-[#2E9E7A]" />
            Aura analytics
          </h1>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Every strike and write-off on your ledger, assayed over the last 30 days.
          </p>
        </div>
        {profile?.is_premium && (
          <Chip tone="brass">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Premium
          </Chip>
        )}
      </motion.header>

      {/* Stat plates — reveal is staggered only when motion is welcome. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.28, delay: i * 0.04, ease: "easeOut" }}
            onHoverStart={() => setHoveredStat(i)}
            onHoverEnd={() => setHoveredStat((current) => (current === i ? null : current))}
            className="h-full"
          >
            <Plate interactive className="h-full p-4 sm:p-5">
              <div className="mb-2 flex items-center gap-2">
                <AnimatedIcon icon={s.icon} idiom={s.idiom} hovered={hoveredStat === i} className={cn("h-4 w-4", s.iconTone)} />
                <SectionLabel>{s.label}</SectionLabel>
              </div>
              {s.node}
            </Plate>
          </motion.div>
        ))}
      </div>

      {/* Win / loss split */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.3, delay: 0.16, ease: "easeOut" }}
      >
        <Plate className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <SectionLabel>Win / loss split</SectionLabel>
            {hasScored && (
              <span className="text-xs text-muted-foreground">
                {scoredOutcomes} scored {scoredOutcomes === 1 ? "entry" : "entries"}
              </span>
            )}
          </div>

          {hasScored ? (
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className={cn("flex items-center gap-1.5 text-xs font-semibold", TONE.posText)}>
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    {stats.totalWins} {stats.totalWins === 1 ? "win" : "wins"}
                  </span>
                  <AuraNumber value={stats.totalGain} size="sm" />
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={reducedMotion ? false : { width: 0 }}
                    animate={{ width: `${winShare}%` }}
                    transition={reducedMotion ? { duration: 0 } : { duration: 0.7, ease: "easeOut" }}
                    className="h-full rounded-full bg-[#1F6F5C] dark:bg-[#2E9E7A]"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{Math.round(winShare)}% of scored entries</p>
              </div>

              <span className="text-xs font-semibold text-muted-foreground" aria-hidden="true">
                vs
              </span>

              <div className="flex-1">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className={cn("flex items-center gap-1.5 text-xs font-semibold", TONE.negText)}>
                    <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                    {stats.totalLosses} {stats.totalLosses === 1 ? "loss" : "losses"}
                  </span>
                  <AuraNumber value={-Math.abs(stats.totalLoss)} size="sm" />
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={reducedMotion ? false : { width: 0 }}
                    animate={{ width: `${lossShare}%` }}
                    transition={reducedMotion ? { duration: 0 } : { duration: 0.7, ease: "easeOut" }}
                    className="h-full rounded-full bg-[#B4442E] dark:bg-[#E0795F]"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{Math.round(lossShare)}% of scored entries</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {stats.totalEvents > 0
                ? "Every entry so far landed on zero, so there is no win or loss share to report yet."
                : "No scored entries yet — log a win or a loss to see the split."}
            </p>
          )}
        </Plate>
      </motion.div>

      {/* 30-day trend */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.3, delay: 0.24, ease: "easeOut" }}
      >
        <Plate className="overflow-visible p-5 sm:p-6">
          <SectionLabel>30-day aura trend</SectionLabel>

          <div
            role="group"
            aria-label="Daily net aura for the last 30 days"
            className="mt-14 flex h-40 items-end gap-[2px] sm:gap-1"
          >
            {dailyTrend.map((day, i) => {
              const polarity = trendPolarity(day.net);
              const heightPct = maxDailyNet > 0 ? (Math.abs(day.net) / maxDailyNet) * 100 : 0;
              const isActive = activeDay === day.date;
              return (
                <div key={day.date} className="group relative flex h-full flex-1 flex-col justify-end">
                  <div
                    className={cn(
                      "pointer-events-none absolute bottom-full left-1/2 z-10 -translate-x-1/2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs whitespace-nowrap shadow-sm transition-opacity",
                      isActive ? "opacity-100" : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                    )}
                    aria-hidden="true"
                  >
                    <p className="font-semibold text-foreground">{day.label}</p>
                    <p className={cn("mono tabular-nums", TREND_TEXT[polarity])}>{formatSignedAura(day.net)}</p>
                    <p className="text-muted-foreground">
                      {day.count} {day.count === 1 ? "event" : "events"}
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label={dayAriaLabel(day.label, day.net, day.count)}
                    onMouseEnter={() => setActiveDay(day.date)}
                    onMouseLeave={() => setActiveDay((current) => (current === day.date ? null : current))}
                    onFocus={() => setActiveDay(day.date)}
                    onBlur={() => setActiveDay((current) => (current === day.date ? null : current))}
                    className="flex h-full w-full items-end rounded-sm"
                  >
                    <motion.span
                      initial={reducedMotion ? false : { height: 0 }}
                      animate={{ height: `${Math.max(heightPct, 2)}%` }}
                      transition={reducedMotion ? { duration: 0 } : { duration: 0.45, delay: i * 0.008, ease: "easeOut" }}
                      className={cn("block min-h-[2px] w-full rounded-t-sm", TREND_FILL[polarity])}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          <p aria-hidden="true" className="mt-3 min-h-5 text-xs text-muted-foreground">
            {activePoint
              ? dayReadout(activePoint.label, activePoint.net, activePoint.count)
              : "Hover or focus a bar for that day's detail."}
          </p>

          <div className="mt-2 flex justify-between">
            <span className="text-xs text-muted-foreground">30 days ago</span>
            <span className="text-xs text-muted-foreground">Today</span>
          </div>

          {/* Text alternative for the chart: same figures, reachable without hover. */}
          <details className="mt-4 border-t border-border/60 pt-3">
            <summary className="cursor-pointer text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Read the 30 days as a table
            </summary>
            <div className="mt-3 max-h-64 overflow-auto">
              <table className="w-full border-collapse text-xs">
                <caption className="sr-only">Daily aura gain, loss and net for the last 30 days</caption>
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th scope="col" className="py-1.5 pr-2 font-semibold">
                      Day
                    </th>
                    <th scope="col" className="px-2 py-1.5 text-right font-semibold">
                      Gain
                    </th>
                    <th scope="col" className="px-2 py-1.5 text-right font-semibold">
                      Loss
                    </th>
                    <th scope="col" className="px-2 py-1.5 text-right font-semibold">
                      Net
                    </th>
                    <th scope="col" className="py-1.5 pl-2 text-right font-semibold">
                      Events
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dailyTrend.map((day) => (
                    <tr key={day.date} className="border-t border-border/50">
                      <th scope="row" className="py-1.5 pr-2 text-left font-normal text-foreground">
                        {day.label}
                      </th>
                      <td className="mono px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                        {day.gain > 0 ? formatSignedAura(day.gain) : "\u2014"}
                      </td>
                      <td className="mono px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                        {day.loss > 0 ? formatSignedAura(-day.loss) : "\u2014"}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <AuraNumber value={day.net} size="sm" />
                      </td>
                      <td className="mono py-1.5 pl-2 text-right tabular-nums text-muted-foreground">{day.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Plate>
      </motion.div>

      {/* Category breakdown + vibe tags */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.3, delay: 0.32, ease: "easeOut" }}
          className="h-full"
        >
          <Plate className="h-full p-5 sm:p-6">
            <SectionLabel>Category breakdown</SectionLabel>
            {categoryBreakdown.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No categorised entries yet. Categories appear once events carry one.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {categoryBreakdown.map((cat) => {
                  const meta = categoryMeta(cat.category);
                  const pct = (cat.count / maxCategoryCount) * 100;
                  return (
                    <li key={cat.category}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
                          <AnimatedIcon icon={meta.icon} idiom="press" className="h-3.5 w-3.5 text-muted-foreground" />
                          {meta.label}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {cat.count} {cat.count === 1 ? "event" : "events"}
                          </span>
                          <AuraNumber value={cat.total} size="sm" />
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <motion.div
                          initial={reducedMotion ? false : { width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={reducedMotion ? { duration: 0 } : { duration: 0.5, delay: 0.1, ease: "easeOut" }}
                          className={cn("h-full rounded-full", VOLUME_FILL)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Plate>
        </motion.div>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.3, delay: 0.32, ease: "easeOut" }}
          className="h-full"
        >
          <Plate className="h-full p-5 sm:p-6">
            <SectionLabel>Top vibe tags</SectionLabel>
            {vibeDistribution && vibeDistribution.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {vibeDistribution.map((vibe, i) => {
                  // Weight reads through border + ink, never through fading the text.
                  const weight = maxVibeCount > 0 ? vibe.count / maxVibeCount : 0;
                  return (
                    <motion.span
                      key={vibe.tag}
                      initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={reducedMotion ? { duration: 0 } : { duration: 0.24, delay: 0.4 + i * 0.04, ease: "easeOut" }}
                    >
                      <Chip tone={weight >= 0.75 ? "pos" : "lead"}>
                        {vibe.tag}
                        <span className="mono tabular-nums opacity-80">{vibe.count}</span>
                      </Chip>
                    </motion.span>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No vibe tags recorded yet.</p>
            )}

            {profile?.is_premium && (
              <div className="mt-6 border-t border-border/60 pt-4">
                <div className="mb-3 flex items-center gap-2">
                  <AnimatedIcon icon={Rocket} idiom="nudge" className="h-4 w-4 text-[#8A6E14] dark:text-[#C9A227]" />
                  <SectionLabel>Boost status</SectionLabel>
                </div>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="mono text-[20px] font-semibold tabular-nums text-foreground">
                      {profile.boosts_remaining || 0}
                    </p>
                    <SectionLabel>Boosts left</SectionLabel>
                  </div>
                  <div>
                    <p className="mono text-[20px] font-semibold tabular-nums text-foreground">{stats.boostedCount}</p>
                    <SectionLabel>Boosted total</SectionLabel>
                  </div>
                </div>
              </div>
            )}
          </Plate>
        </motion.div>
      </div>

      {/* Highlights */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.3, delay: 0.4, ease: "easeOut" }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4"
      >
        {highlights?.topWin && (
          <Plate rail={highlights.topWin.points} interactive className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <AnimatedIcon icon={Trophy} idiom="strike" className={cn("h-4 w-4", TONE.posText)} />
              <SectionLabel className={TONE.posText}>Biggest win</SectionLabel>
            </div>
            <p className="mb-2 line-clamp-2 text-xs leading-relaxed text-foreground">
              {highlights.topWin.description}
            </p>
            <AuraNumber value={highlights.topWin.points} size="sm" />
          </Plate>
        )}

        {highlights?.topLoss && (
          <Plate rail={highlights.topLoss.points} interactive className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <AnimatedIcon icon={TrendingDown} idiom="strike" className={cn("h-4 w-4", TONE.negText)} />
              <SectionLabel className={TONE.negText}>Biggest loss</SectionLabel>
            </div>
            <p className="mb-2 line-clamp-2 text-xs leading-relaxed text-foreground">
              {highlights.topLoss.description}
            </p>
            <AuraNumber value={highlights.topLoss.points} size="sm" />
          </Plate>
        )}

        {highlights?.mostVoted && (
          <Plate interactive className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <AnimatedIcon icon={Crown} idiom="strike" className={cn("h-4 w-4", TONE.brassText)} />
              <SectionLabel className={TONE.brassText}>Most popular</SectionLabel>
            </div>
            <p className="mb-2 line-clamp-2 text-xs leading-relaxed text-foreground">
              {highlights.mostVoted.description}
            </p>
            <p className="mono text-[14px] font-semibold tabular-nums text-[#8A6E14] dark:text-[#C9A227]">
              {highlights.mostVoted.upvotes} {highlights.mostVoted.upvotes === 1 ? "upvote" : "upvotes"}
            </p>
          </Plate>
        )}
      </motion.div>
    </div>
  );
}
