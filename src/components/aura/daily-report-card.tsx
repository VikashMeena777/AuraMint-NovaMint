"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, TrendingUp, TrendingDown, Sparkles, Calendar } from "lucide-react";
import { getDailyReport, type DailyReport } from "@/lib/actions/daily-report";
import { formatAuraPoints } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function DailyReportCard() {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDailyReport().then((r) => {
      setReport(r);
      setLoading(false);
    });
  }, []);

  if (loading) return null;
  if (!report) return null;

  const isPositiveDay = report.totalAuraGained >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "glass noise relative mb-6 overflow-hidden rounded-3xl border border-border/30",
        isPositiveDay ? "glow-win" : "glow-loss"
      )}
    >
      {/* Background soft color orb matching day status */}
      <div className={cn(
        "absolute -left-20 -top-20 h-40 w-40 rounded-full blur-3xl opacity-20 pointer-events-none",
        isPositiveDay ? "bg-emerald-500/10" : "bg-red-500/10"
      )} />

      <div className="relative z-10 p-6">
        {/* Header Widget */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 border border-primary/5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/80">
              Today&apos;s Daily Aura Report
            </span>
          </div>
          {report.streakDays > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-orange-500/10 border border-orange-500/20 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-orange-400">
              <Flame className="h-3.5 w-3.5" />
              {report.streakDays}d Streak
            </span>
          )}
        </div>

        {/* Massive cumulative points banner */}
        <div className="mt-5 flex items-baseline gap-3">
          <span className={cn(
            "heading text-3xl font-extrabold tracking-tighter leading-none grad-text",
            isPositiveDay ? "text-emerald-400" : "text-red-400"
          )} style={{ fontFamily: "var(--font-display)" }}>
            {isPositiveDay ? "+" : ""}
            {formatAuraPoints(report.totalAuraGained)}
          </span>
          <span className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">
            Gain from {report.totalEvents} event{report.totalEvents !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Grid display for Biggest W & L highlights */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          {report.biggestW && (
            <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/10 p-3.5">
              <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-widest text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" />
                Biggest W
              </div>
              <p className="heading mt-2 text-base tracking-tight leading-none text-emerald-400">
                +{formatAuraPoints(report.biggestW.points)}{" "}
                <span className="text-lg leading-none">{report.biggestW.emoji}</span>
              </p>
            </div>
          )}
          {report.biggestL && (
            <div className="rounded-2xl bg-red-500/5 border border-red-500/10 p-3.5">
              <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-widest text-red-400">
                <TrendingDown className="h-3.5 w-3.5" />
                Biggest L
              </div>
              <p className="heading mt-2 text-base tracking-tight leading-none text-red-400">
                {formatAuraPoints(report.biggestL.points)}{" "}
                <span className="text-lg leading-none">{report.biggestL.emoji}</span>
              </p>
            </div>
          )}
        </div>

        {/* Vibe metadata footer info */}
        <div className="mt-5 flex items-center gap-2 border-t border-border/20 pt-4">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-accent/10">
            <Sparkles className="h-3 w-3 text-accent" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
            Vibe of the day:
          </span>
          <span className="text-[11px] font-extrabold text-accent bg-accent/5 px-2.5 py-0.5 rounded-full border border-accent/15">
            {report.vibeOfTheDay}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
