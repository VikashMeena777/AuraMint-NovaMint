"use client";

import { useState, useEffect, useCallback } from "react";
import { AuraEventCard } from "@/components/aura/aura-event-card";
import { SubmitEventModal } from "@/components/aura/submit-event-modal";
import { getPublicFeed } from "@/lib/actions/aura-actions";
import { Flame, Clock, TrendingUp, Sparkles, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { AdBanner } from "@/components/aura/ad-banner";
import { DailyReportCard } from "@/components/aura/daily-report-card";

type FeedTab = "hot" | "fresh" | "top";

const tabs: { key: FeedTab; label: string; icon: typeof Flame }[] = [
  { key: "hot", label: "Hot", icon: Flame },
  { key: "fresh", label: "Fresh", icon: Clock },
  { key: "top", label: "Top", icon: TrendingUp },
];

export default function DashboardClient() {
  const [tab, setTab] = useState<FeedTab>("hot");
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadEvents = useCallback(async (reset = false) => {
    const currentPage = reset ? 0 : page;
    setLoading(true);
    const result = await getPublicFeed(tab, currentPage);
    const newEvents = result.events || [];
    setEvents(reset ? newEvents : [...events, ...newEvents]);
    setHasMore(result.hasMore);
    if (!reset) setPage(currentPage + 1);
    setLoading(false);
  }, [tab, page, events]);

  useEffect(() => {
    setPage(0);
    setEvents([]);
    setHasMore(true);
    loadEvents(true);
  }, [tab]);

  function handleEventSubmitted() {
    setTab("fresh");
    setPage(0);
    setEvents([]);
    setHasMore(true);
    loadEvents(true);
  }

  return (
    <div className="mx-auto max-w-xl">
      {/* ── Header ── */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="heading text-2xl">Feed</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Today&apos;s aura-defining moments
          </p>
        </div>
        <SubmitEventModal onEventSubmitted={handleEventSubmitted} />
      </div>

      {/* ── Daily Report ── */}
      <DailyReportCard />

      {/* ── Tab Bar ── */}
      <div className="mb-6 inline-flex rounded-xl bg-secondary/40 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-semibold transition-all",
              tab === t.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Ad Banner (free users) ── */}
      <div className="mb-4">
        <AdBanner />
      </div>

      {/* ── Event Feed ── */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {events.map((ev, i) => (
            <AuraEventCard key={ev.id} event={ev} index={i} />
          ))}
        </AnimatePresence>

        {/* Loading Skeleton */}
        {loading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="glass animate-pulse p-6">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-muted" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-24 rounded-full bg-muted" />
                    <div className="h-2.5 w-16 rounded-full bg-muted" />
                  </div>
                </div>
                <div className="mt-4 h-3 w-3/4 rounded-full bg-muted" />
                <div className="mt-2 h-3 w-1/2 rounded-full bg-muted" />
                <div className="mt-4 h-8 w-20 rounded bg-muted" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && events.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass noise relative py-16 text-center"
          >
            <div className="relative z-10">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10">
                <Crown className="h-7 w-7 text-primary" />
              </div>
              <h3 className="heading text-lg">No events yet</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
                Be the first to log an aura moment. Tap the ✨ button to get started!
              </p>
            </div>
          </motion.div>
        )}

        {/* Load More */}
        {!loading && hasMore && events.length > 0 && (
          <button
            onClick={() => loadEvents()}
            className="w-full rounded-xl border border-border/50 py-3 text-[12px] font-semibold text-muted-foreground transition hover:bg-secondary/40 hover:text-foreground"
          >
            Load More
          </button>
        )}
      </div>
    </div>
  );
}
