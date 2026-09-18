"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Trophy, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BADGES, getEarnedBadges, getLockedBadges, type UserStats } from "@/lib/badges";
import { cn } from "@/lib/utils";
import { BadgeStamp, RARITY_META, type Rarity } from "@/components/aura/badge-stamp";
import { Chip, EmptyState, Plate, PrimaryButton } from "@/components/aura/primitives";

type ProfileRow = {
  total_aura?: number | null;
  current_tier?: string | null;
  streak_days?: number | null;
  is_premium?: boolean | null;
  created_at?: string | null;
};

export default function BadgesClient() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    mounted.current = true;
    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          // Previously returned before clearing `loading`, so the skeleton hung forever.
          if (mounted.current) setError("Sign in to see your hallmark sheet.");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("total_aura, current_tier, streak_days, is_premium, created_at")
          .eq("id", user.id)
          .single();

        const { data: events } = await supabase
          .from("aura_events")
          .select("aura_points")
          .eq("user_id", user.id);

        const p = (profile as ProfileRow | null) ?? null;
        const points = ((events ?? []) as { aura_points?: number | null }[]).map((e) => e.aura_points ?? 0);
        const daysActive = p?.created_at
          ? Math.max(0, Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86_400_000))
          : 0;

        if (mounted.current) {
          setStats({
            totalAura: p?.total_aura ?? 0,
            totalEvents: points.length,
            streakDays: p?.streak_days ?? 0,
            biggestW: points.length > 0 ? Math.max(...points) : 0,
            biggestL: points.length > 0 ? Math.min(...points) : 0,
            tier: p?.current_tier ?? "NPC",
            isPremium: Boolean(p?.is_premium),
            daysActive,
          });
          setError(null);
        }
      } catch {
        if (mounted.current) setError("Couldn't load your badges. Retry in a moment.");
      } finally {
        if (mounted.current) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted.current = false;
    };
  }, [refreshKey]);

  const earned = stats ? getEarnedBadges(stats) : [];
  const locked = stats ? getLockedBadges(stats) : [];
  const pct = BADGES.length > 0 ? Math.round((earned.length / BADGES.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-5">
        <h1 className="font-display text-3xl leading-none text-foreground">Hallmark sheet</h1>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {stats ? `${earned.length} of ${BADGES.length} marks struck` : "Counting your marks"}
        </p>
      </header>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Plate key={i} className="p-5">
              <div className="mx-auto h-14 w-14 animate-pulse rounded-xl bg-muted" />
              <div className="mx-auto mt-3 h-3 w-20 animate-pulse rounded bg-muted" />
            </Plate>
          ))}
        </div>
      ) : error ? (
        <Plate className="px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <PrimaryButton className="mt-4" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </PrimaryButton>
        </Plate>
      ) : !stats ? (
        <EmptyState icon={<Trophy className="h-6 w-6" aria-hidden="true" />} title="No stats yet" description="Log an event to start earning marks." />
      ) : (
        <>
          <div className="mb-6">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={BADGES.length}
              aria-valuenow={earned.length}
              aria-label="Badges unlocked"
              className="h-2 overflow-hidden rounded-full bg-secondary"
            >
              <div className="h-full rounded-full bg-[#1F6F5C] transition-[width] duration-700" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {earned.length === 0 ? (
            <EmptyState
              className="mb-6"
              icon={<Trophy className="h-6 w-6" aria-hidden="true" />}
              title="No marks struck yet"
              description="Your first entry unlocks First Aura. Keep the ledger growing to strike the rare marks."
            />
          ) : (
            <section className="mb-8">
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Struck · {earned.length}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {earned.map((badge, i) => (
                  <motion.div
                    key={badge.id}
                    initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={reducedMotion ? { duration: 0 } : { duration: 0.28, delay: Math.min(i, 9) * 0.03 }}
                  >
                    <Plate className="flex h-full flex-col items-center p-5 text-center">
                      <BadgeStamp id={badge.id} rarity={badge.rarity as Rarity} earned />
                      <p className="mt-3 text-xs font-semibold leading-tight text-foreground">{badge.name}</p>
                      <p className="mt-1 min-h-[30px] text-[11px] leading-relaxed text-muted-foreground">{badge.description}</p>
                      <span className={cn("mt-2 text-[10px] font-semibold uppercase tracking-[0.14em]", RARITY_META[badge.rarity as Rarity].text)}>
                        {RARITY_META[badge.rarity as Rarity].label}
                      </span>
                    </Plate>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {locked.length > 0 ? (
            <section>
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Unstruck · {locked.length}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {locked.map((badge) => (
                  <Plate key={badge.id} className="flex h-full flex-col items-center p-5 text-center opacity-80">
                    <BadgeStamp id={badge.id} rarity={badge.rarity as Rarity} earned={false} />
                    <p className="mt-3 text-xs font-semibold leading-tight text-muted-foreground">{badge.name}</p>
                    <p className="mt-1 min-h-[30px] text-[11px] leading-relaxed text-muted-foreground/80">{badge.requirement}</p>
                    <Chip tone="lead" className="mt-2">
                      Locked
                    </Chip>
                  </Plate>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
