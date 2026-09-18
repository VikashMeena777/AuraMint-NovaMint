"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Calendar, Flame, TrendingUp, TrendingDown, Sparkles, Plus } from "lucide-react";
import { AuraNumber } from "./aura-number";
import { Chip, EmojiMark, Plate } from "./primitives";
import { MINT } from "./mint";
import { useDailyReport } from "./hooks";
import { playHapticPop } from "@/lib/utils/sound";

/**
 * Today's receipt strip: net aura (signed, patina/oxide), the biggest W and L as two
 * stamped cells, streak as a notch count. Replaces the glass card + double-signed
 * `++1.2K` banner.
 */
export function DailyReportCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const { report, loading, error } = useDailyReport(refreshKey);
  const reducedMotion = useReducedMotion();

  if (loading) {
    return (
      <Plate className="mb-5 p-5">
        <div className="h-3 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
        </div>
      </Plate>
    );
  }

  if (error) {
    return (
      <Plate className="mb-5 px-4 py-3">
        <p className="text-[11px] text-muted-foreground">
          Today&apos;s report couldn&apos;t be loaded. The ledger itself is unaffected.
        </p>
      </Plate>
    );
  }

  if (!report) {
    return (
      <Plate className="mb-5 px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Nothing minted today
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              playHapticPop();
              window.dispatchEvent(new CustomEvent("open-submit-modal"));
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#1F6F5C]/40 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#16604F] dark:text-[#43B994]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Log one
          </button>
        </div>
      </Plate>
    );
  }

  const net = report.totalAuraGained;

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.3, ease: "easeOut" }}
      className="mb-5"
    >
      <Plate rail={net} className="p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            Today&apos;s receipt
          </span>
          {report.streakDays > 0 ? (
            <Chip tone="brass">
              <Flame className="h-3 w-3" aria-hidden="true" />
              {report.streakDays}d streak
            </Chip>
          ) : null}
        </div>

        <div className="mt-4 flex items-baseline gap-3">
          <AuraNumber value={net} size="xl" animate />
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            from {report.totalEvents} event{report.totalEvents === 1 ? "" : "s"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#1F6F5C]/25 bg-[#1F6F5C]/5 p-3">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: MINT.patinaBright }}>
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
              Biggest W
            </span>
            {report.biggestW ? (
              <span className="mt-2 flex items-center gap-2">
                <AuraNumber value={report.biggestW.points} size="sm" />
                <EmojiMark emoji={report.biggestW.emoji} className="text-base" label="biggest win emoji" />
              </span>
            ) : (
              <span className="mt-2 block text-xs text-muted-foreground">—</span>
            )}
          </div>
          <div className="rounded-xl border border-[#B4442E]/25 bg-[#B4442E]/5 p-3">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: MINT.oxideLight }}>
              <TrendingDown className="h-3 w-3" aria-hidden="true" />
              Biggest L
            </span>
            {report.biggestL ? (
              <span className="mt-2 flex items-center gap-2">
                <AuraNumber value={report.biggestL.points} size="sm" />
                <EmojiMark emoji={report.biggestL.emoji} className="text-base" label="biggest loss emoji" />
              </span>
            ) : (
              <span className="mt-2 block text-xs text-muted-foreground">—</span>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3">
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Vibe of the day</span>
          <span className="text-xs font-semibold text-foreground">{report.vibeOfTheDay}</span>
        </div>
      </Plate>
    </motion.div>
  );
}
