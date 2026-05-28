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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "glass noise relative mb-6 overflow-hidden",
        isPositiveDay ? "glow-win" : "glow-loss"
      )}
    >
      <div className="relative z-10 p-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-[12px] font-semibold text-muted-foreground">
              Today&apos;s Aura Report
            </span>
          </div>
          {report.streakDays > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-orange-500">
              <Flame className="h-3 w-3" />
              {report.streakDays}d streak
            </span>
          )}
        </div>

        {/* Main stats */}
        <div className="mt-3 flex items-baseline gap-3">
          <span className={cn(
            "mono text-[28px] font-extrabold tracking-tighter leading-none",
            isPositiveDay ? "text-emerald-400" : "text-red-400"
          )}>
            {formatAuraPoints(report.totalAuraGained)}
          </span>
          <span className="text-[12px] text-muted-foreground">
            from {report.totalEvents} event{report.totalEvents !== 1 ? "s" : ""}
          </span>
        </div>

        {/* W & L */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {report.biggestW && (
            <div className="rounded-lg bg-emerald-500/5 p-2.5">
              <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                <TrendingUp className="h-3 w-3" />
                Biggest W
              </div>
              <p className="mono mt-1 text-sm font-bold text-emerald-400">
                {formatAuraPoints(report.biggestW.points)} {report.biggestW.emoji}
              </p>
            </div>
          )}
          {report.biggestL && (
            <div className="rounded-lg bg-red-500/5 p-2.5">
              <div className="flex items-center gap-1 text-[10px] font-semibold text-red-400">
                <TrendingDown className="h-3 w-3" />
                Biggest L
              </div>
              <p className="mono mt-1 text-sm font-bold text-red-400">
                {formatAuraPoints(report.biggestL.points)} {report.biggestL.emoji}
              </p>
            </div>
          )}
        </div>

        {/* Vibe */}
        <div className="mt-3 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-accent" />
          <span className="text-[11px] font-medium text-muted-foreground">
            Vibe of the day:
          </span>
          <span className="text-[11px] font-bold text-accent">
            {report.vibeOfTheDay}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
