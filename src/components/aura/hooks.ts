"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getDailyReport } from "@/lib/actions/daily-report";

/* ─────────────────────────────── viewer ─────────────────────────────── */

export type ViewerState = {
  userId: string | null;
  username: string | null;
  isPremium: boolean;
  ready: boolean;
};

/**
 * The signed-in viewer's identity + premium state, fetched once. Used for ownership
 * checks (`isOwner`), the real ad-banner gate and the share-card watermark, so no
 * surface has to invent `isPremium` from unrelated state (the old
 * `isPremium: isOwner` hack in the feed).
 */
export function useViewer(): ViewerState {
  const [state, setState] = useState<ViewerState>({
    userId: null,
    username: null,
    isPremium: false,
    ready: false,
  });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    async function load() {
      const next: ViewerState = { userId: null, username: null, isPremium: false, ready: true };
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          next.userId = user.id;
          const { data } = await supabase
            .from("profiles")
            .select("username, is_premium")
            .eq("id", user.id)
            .maybeSingle();
          const row = data as { username?: string | null; is_premium?: boolean | null } | null;
          next.username = row?.username ?? null;
          next.isPremium = Boolean(row?.is_premium);
        }
      } catch {
        // Degrade to anonymous viewer rather than leaving the UI pending forever.
      }
      if (mounted.current) setState(next);
    }
    void load();
    return () => {
      mounted.current = false;
    };
  }, []);

  return state;
}

/* ─────────────────────────────── plan limits ─────────────────────────────── */

export type PlanLimitsState = {
  isPremium: boolean;
  /** `null` means "unlimited / unknown". */
  dailyEventsLimit: number | null;
  dailyEventsUsed: number;
  canSubmit: boolean;
  hasAds: boolean;
  shareWatermark: boolean;
  ready: boolean;
};

const FALLBACK_LIMITS: PlanLimitsState = {
  isPremium: false,
  dailyEventsLimit: 5,
  dailyEventsUsed: 0,
  canSubmit: true,
  hasAds: true,
  shareWatermark: true,
  ready: true,
};

type PlanLimitsResponse = {
  isPremium?: boolean;
  dailyEventsLimit?: number | null;
  dailyEventsUsed?: number;
  canSubmit?: boolean;
  hasAds?: boolean;
  shareWatermark?: boolean;
};

/**
 * Real server-side premium flags and daily quota. The backend reports `Infinity` for
 * premium historically; anything non-finite is normalised to `null` (unlimited) so
 * nothing renders `Infinity` or a broken progress bar.
 */
export function usePlanLimits(refreshKey = 0): PlanLimitsState {
  const [state, setState] = useState<PlanLimitsState>({ ...FALLBACK_LIMITS, ready: false });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    async function load() {
      try {
        const { getUserPlanLimits } = await import("@/lib/actions/plan-actions");
        const res = (await getUserPlanLimits()) as PlanLimitsResponse | null;
        if (!res) throw new Error("no limits");
        const limit = typeof res.dailyEventsLimit === "number" && Number.isFinite(res.dailyEventsLimit)
          ? res.dailyEventsLimit
          : null;
        if (mounted.current) {
          setState({
            isPremium: Boolean(res.isPremium),
            dailyEventsLimit: limit,
            dailyEventsUsed: Math.max(0, res.dailyEventsUsed ?? 0),
            canSubmit: res.canSubmit ?? true,
            hasAds: res.hasAds ?? !res.isPremium,
            shareWatermark: res.shareWatermark ?? !res.isPremium,
            ready: true,
          });
        }
      } catch {
        if (mounted.current) setState(FALLBACK_LIMITS);
      }
    }
    void load();
    return () => {
      mounted.current = false;
    };
  }, [refreshKey]);

  return state;
}

/* ─────────────────────────────── daily report ─────────────────────────────── */

export type DailyReportState = {
  report: Awaited<ReturnType<typeof getDailyReport>>;
  loading: boolean;
  error: boolean;
};

/** Daily report with a real error state (the old `.then()` had no rejection path). */
export function useDailyReport(refreshKey = 0): DailyReportState {
  const [state, setState] = useState<{ report: DailyReportState["report"]; key: number; error: boolean }>({
    report: null,
    key: -1,
    error: false,
  });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    async function load() {
      try {
        const report = await getDailyReport();
        if (mounted.current) setState({ report, key: refreshKey, error: false });
      } catch {
        if (mounted.current) setState({ report: null, key: refreshKey, error: true });
      }
    }
    void load();
    return () => {
      mounted.current = false;
    };
  }, [refreshKey]);

  return {
    report: state.report,
    error: state.error,
    loading: state.key !== refreshKey,
  };
}
