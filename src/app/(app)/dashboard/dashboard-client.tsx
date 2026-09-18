"use client";

import { useEffect, useRef, useState } from "react";
import { Flame, Clock, TrendingUp, Crown, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPublicFeed } from "@/lib/actions/aura-actions";
import { AuraEventCard } from "@/components/aura/aura-event-card";
import { AdBanner } from "@/components/aura/ad-banner";
import { DailyReportCard } from "@/components/aura/daily-report-card";
import { EVENT_MINTED_EVENT } from "@/components/aura/submit-event-modal";
import { useViewer } from "@/components/aura/hooks";
import { EmptyState, Plate, PrimaryButton, SkeletonPlate } from "@/components/aura/primitives";
import type { AuraEvent, FeedTab } from "@/components/aura/types";

const TABS: { key: FeedTab; label: string; icon: typeof Flame }[] = [
  { key: "hot", label: "Hot", icon: Flame },
  { key: "fresh", label: "Fresh", icon: Clock },
  { key: "top", label: "Top", icon: TrendingUp },
];

type FeedState = {
  tab: FeedTab;
  events: AuraEvent[];
  /** Last successfully loaded page for `tab`. */
  page: number;
  hasMore: boolean;
  loaded: boolean;
};

/** One page from the feed action, normalised. */
async function fetchFeedPage(tab: FeedTab, page: number): Promise<{ events: AuraEvent[]; hasMore: boolean }> {
  const res = (await getPublicFeed(tab, page)) as { events?: AuraEvent[]; hasMore?: boolean } | null;
  return { events: Array.isArray(res?.events) ? res.events : [], hasMore: Boolean(res?.hasMore) };
}

/**
 * Merge a page into the accumulator: `append` keeps the current list (same tab only) and
 * de-duplicates by id, `replace` starts fresh. The previous implementation re-fetched page
 * 0 on every "Load more" (duplicate rows + duplicate React keys) because `page` was never
 * advanced by the reset path.
 */
function buildFeed(
  prev: FeedState,
  tab: FeedTab,
  page: number,
  incoming: AuraEvent[],
  hasMore: boolean,
  mode: "replace" | "append"
): FeedState {
  const base = mode === "append" && prev.tab === tab ? prev.events : [];
  const seen = new Set(base.map((e) => e.id));
  return {
    tab,
    events: [...base, ...incoming.filter((e) => e && !seen.has(e.id))],
    page,
    hasMore,
    loaded: true,
  };
}

export default function DashboardClient() {
  const [tab, setTab] = useState<FeedTab>("hot");
  const [feed, setFeed] = useState<FeedState>({ tab: "hot", events: [], page: 0, hasMore: false, loaded: false });
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const viewer = useViewer();

  /** Monotonic request id — a stale response can never overwrite a newer one. */
  const requestSeq = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loading = !feed.loaded || feed.tab !== tab;

  // Reset + first page. The loader lives inside the effect so every state write happens
  // in an async continuation, never during the effect body or render.
  useEffect(() => {
    let cancelled = false;
    const id = ++requestSeq.current;
    async function run() {
      try {
        const page = await fetchFeedPage(tab, 0);
        if (cancelled || id !== requestSeq.current) return;
        setFeed((prev) => buildFeed(prev, tab, 0, page.events, page.hasMore, "replace"));
        setError(null);
      } catch {
        if (cancelled || id !== requestSeq.current) return;
        setError("Couldn't load the ledger. Check your connection and retry.");
        setFeed((prev) => ({ ...prev, tab, loaded: true }));
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [tab, refreshKey]);

  // A mint anywhere in the app refreshes the ledger (the log sheet is globally mounted).
  useEffect(() => {
    function onMinted() {
      setTab("fresh");
      setRefreshKey((k) => k + 1);
    }
    window.addEventListener(EVENT_MINTED_EVENT, onMinted);
    return () => window.removeEventListener(EVENT_MINTED_EVENT, onMinted);
  }, []);

  // Legacy `/dashboard?action=log` deep link from the command palette.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") !== "log") return;
    window.dispatchEvent(new CustomEvent("open-submit-modal"));
    const url = new URL(window.location.href);
    url.searchParams.delete("action");
    window.history.replaceState({}, "", url.toString());
  }, []);

  async function loadMore() {
    if (loading || loadingMore) return;
    if (!feed.hasMore) return;
    setLoadingMore(true);
    const id = ++requestSeq.current;
    try {
      const nextPage = feed.page + 1;
      const page = await fetchFeedPage(tab, nextPage);
      if (id !== requestSeq.current) return;
      setFeed((prev) => buildFeed(prev, tab, nextPage, page.events, page.hasMore, "append"));
      setError(null);
    } catch {
      if (id === requestSeq.current) setError("Couldn't load more entries. Retry.");
    } finally {
      if (id === requestSeq.current) setLoadingMore(false);
    }
  }

  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  });

  // Honest infinite scroll: the sentinel appends the next page; the button remains as a
  // keyboard / observer-less fallback.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMoreRef.current();
      },
      { rootMargin: "400px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [feed.hasMore, loading]);

  function openLog() {
    window.dispatchEvent(new CustomEvent("open-submit-modal"));
  }

  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl leading-none text-foreground">The Ledger</h1>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {feed.loaded && !loading
              ? `${feed.events.length} entr${feed.events.length === 1 ? "y" : "ies"} minted${feed.hasMore ? " · more below" : ""}`
              : "Assaying today's moments"}
          </p>
        </div>
        <PrimaryButton onClick={openLog} className="shrink-0">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Log
        </PrimaryButton>
      </header>

      <DailyReportCard refreshKey={refreshKey} />

      <div
        role="tablist"
        aria-label="Feed ordering"
        className="mb-5 flex gap-1 rounded-xl border border-border/70 bg-secondary/20 p-1"
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          const i = TABS.findIndex((t) => t.key === tab);
          const next = e.key === "ArrowRight" ? (i + 1) % TABS.length : (i - 1 + TABS.length) % TABS.length;
          setTab(TABS[next].key);
        }}
      >
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors",
                active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      <div className="mb-5">{viewer.ready ? <AdBanner isPremium={viewer.isPremium} /> : null}</div>

      <div className="space-y-4">
        {loading ? (
          <>
            <SkeletonPlate className="h-44" />
            <SkeletonPlate className="h-40" />
          </>
        ) : error && feed.events.length === 0 ? (
          <Plate className="px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <PrimaryButton className="mt-4" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry
            </PrimaryButton>
          </Plate>
        ) : feed.events.length === 0 ? (
          <EmptyState
            icon={<Crown className="h-6 w-6" aria-hidden="true" />}
            title="No entries yet"
            description="Be the first to mint an aura moment. Describe what happened and the assayer does the rest."
            action={
              <PrimaryButton onClick={openLog}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Log your first event
              </PrimaryButton>
            }
          />
        ) : (
          <>
            {error ? (
              <Plate className="flex items-center justify-between gap-3 px-4 py-2.5">
                <p className="text-[11px] text-muted-foreground">{error}</p>
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground"
                >
                  Retry
                </button>
              </Plate>
            ) : null}

            {feed.events.map((ev, i) => (
              <AuraEventCard
                key={ev.id}
                event={ev}
                index={i}
                isOwner={viewer.userId !== null && viewer.userId === ev.user_id}
                isPremium={viewer.isPremium}
              />
            ))}

            <div ref={sentinelRef} aria-hidden="true" className="h-1" />

            {loadingMore ? <SkeletonPlate className="h-32" /> : null}

            {!loadingMore && feed.hasMore ? (
              <button
                type="button"
                onClick={() => void loadMore()}
                className="w-full rounded-xl border border-border/70 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Load more entries
              </button>
            ) : null}

            {!feed.hasMore ? (
              <p className="pt-1 text-center text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                End of the ledger
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
