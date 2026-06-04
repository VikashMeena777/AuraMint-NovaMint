"use client";

import { useState, useEffect, useCallback } from "react";
import { AuraEventCard } from "@/components/aura/aura-event-card";
import { SubmitEventModal } from "@/components/aura/submit-event-modal";
import { getPublicFeed } from "@/lib/actions/aura-actions";
import { Flame, Clock, TrendingUp, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { AdBanner } from "@/components/aura/ad-banner";
import { DailyReportCard } from "@/components/aura/daily-report-card";
import { createClient } from "@/lib/supabase/client";

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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current user ID for ownership check
  useEffect(() => {
    async function getUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    }
    getUser();
  }, []);

  const loadEvents = useCallback(async (reset = false) => {
    const currentPage = reset ? 0 : page;
    setLoading(true);
    const result = await getPublicFeed(tab, currentPage);
    let newEvents = result.events || [];
    
    // Sort boosted events first (they get priority visibility)
    newEvents = newEvents.sort((a: any, b: any) => {
      if (a.is_boosted && !b.is_boosted) return -1;
      if (!a.is_boosted && b.is_boosted) return 1;
      return 0;
    });
    
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
      {/* ── Header Dashboard Portal ── */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="heading text-3xl tracking-tight leading-none">Feed</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Today&apos;s most aura-defining life moments
          </p>
        </div>
        <SubmitEventModal onEventSubmitted={handleEventSubmitted} />
      </div>

      {/* ── Daily Summary AI Widget ── */}
      <DailyReportCard />

      {/* ── Premium Segment Tab Selector ── */}
      <div className="mb-6 flex justify-start">
        <div className="inline-flex rounded-2xl bg-secondary/30 p-1 border border-border/20 backdrop-blur-md">
          {tabs.map((t) => {
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all",
                  isActive
                    ? "bg-card text-primary shadow-sm border border-border/30"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <t.icon className={cn("h-3.5 w-3.5", isActive ? "text-primary" : "text-muted-foreground/60")} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Banner Advertisement area ── */}
      <div className="mb-6">
        <AdBanner />
      </div>

      {/* ── Infinite Scrolling Feed list ── */}
      <div className="space-y-5">
        <AnimatePresence mode="popLayout">
          {events.map((ev, i) => (
            <AuraEventCard
              key={ev.id}
              event={ev}
              index={i}
              isOwner={currentUserId === ev.user_id}
            />
          ))}
        </AnimatePresence>

        {/* High-fidelity Skeleton Loaders */}
        {loading && (
          <div className="space-y-5">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="glass animate-pulse p-6 border border-border/30 rounded-3xl">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-muted/60" />
                  <div className="space-y-2">
                    <div className="h-3.5 w-28 rounded-full bg-muted/50" />
                    <div className="h-2.5 w-16 rounded-full bg-muted/30" />
                  </div>
                </div>
                <div className="mt-5 space-y-2">
                  <div className="h-3 w-5/6 rounded-full bg-muted/40" />
                  <div className="h-3 w-2/3 rounded-full bg-muted/40" />
                </div>
                <div className="mt-6 flex gap-2">
                  <div className="h-8 w-24 rounded-full bg-muted/55" />
                  <div className="h-8 w-20 rounded-full bg-muted/40" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Custom Redesigned Empty State */}
        {!loading && events.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass noise relative py-20 text-center border border-border/30 rounded-3xl"
          >
            <div className="relative z-10 px-6">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 border border-primary/5 shadow-inner">
                <Crown className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <h3 className="heading text-xl tracking-tight">No Events Logged</h3>
              <p className="mx-auto mt-2 max-w-sm text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Be the pioneer of the aura space! Share an aura event using the floating controller and start trending.
              </p>
            </div>
          </motion.div>
        )}

        {/* Load More Button */}
        {!loading && hasMore && events.length > 0 && (
          <button
            onClick={() => loadEvents()}
            className="w-full rounded-2xl border border-border/50 bg-card/25 py-3.5 text-xs font-bold uppercase tracking-wider text-muted-foreground transition hover:bg-secondary/45 hover:text-foreground"
          >
            Load More Events
          </button>
        )}
      </div>
    </div>
  );
}
