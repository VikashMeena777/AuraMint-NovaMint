"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Swords, Share2, ArrowLeft, Flame, Crown, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { AuraNumber } from "@/components/aura/aura-number";
import { Chip, EmptyState, Plate, PrimaryButton } from "@/components/aura/primitives";
import { TierMark } from "@/components/aura/tier-mark";
import { appOrigin } from "@/components/aura/mint";
import { playAuraGainSound, playHapticPop } from "@/lib/utils/sound";

type DuelProfile = {
  username: string;
  display_name: string | null;
  total_aura: number | null;
  current_tier: string | null;
  streak_days: number | null;
  is_premium: boolean | null;
};

const SELECT = "username, display_name, total_aura, current_tier, streak_days, is_premium";

export default function DuelClient({ user1, user2 }: { user1: string; user2: string }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<{ key: number; p1: DuelProfile | null; p2: DuelProfile | null; error: string | null }>({
    key: -1,
    p1: null,
    p2: null,
    error: null,
  });
  const [sharing, setSharing] = useState(false);
  const loading = state.key !== refreshKey;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createClient();
        const [r1, r2] = await Promise.all([
          supabase.from("profiles").select(SELECT).eq("username", user1).maybeSingle(),
          supabase.from("profiles").select(SELECT).eq("username", user2).maybeSingle(),
        ]);
        if (cancelled) return;
        if (r1.error || !r1.data) {
          setState({ key: refreshKey, p1: null, p2: null, error: `@${user1} isn't in the ledger.` });
          return;
        }
        if (r2.error || !r2.data) {
          setState({ key: refreshKey, p1: null, p2: null, error: `@${user2} isn't in the ledger.` });
          return;
        }
        setState({ key: refreshKey, p1: r1.data as DuelProfile, p2: r2.data as DuelProfile, error: null });
      } catch {
        if (!cancelled) {
          setState({ key: refreshKey, p1: null, p2: null, error: "Couldn't load the duel. Retry in a moment." });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user1, user2, refreshKey]);

  const p1 = state.p1;
  const p2 = state.p2;
  const error = state.error;

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-2xl items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Loading duel</span>
      </div>
    );
  }

  if (error || !p1 || !p2) {
    return (
      <div className="mx-auto max-w-md pt-10">
        <EmptyState
          icon={<Swords className="h-6 w-6" aria-hidden="true" />}
          title="Duel unavailable"
          description={error ?? "One of these handles is missing."}
          action={
            <PrimaryButton onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry
            </PrimaryButton>
          }
        />
      </div>
    );
  }

  const aura1 = p1.total_aura ?? 0;
  const aura2 = p2.total_aura ?? 0;
  const delta = Math.abs(aura1 - aura2);
  const draws = aura1 === aura2;
  const p1Wins = aura1 > aura2;

  const verdict = draws
    ? "A perfect mirror. Identical aura frequency — the ledger has no tiebreaker."
    : delta > 50000
      ? `@${p1Wins ? p1.username : p2.username} is in a different weight class. @${p1Wins ? p2.username : p1.username} needs a redemption arc immediately.`
      : `@${p1Wins ? p1.username : p2.username} holds the higher line, but only by ${delta.toLocaleString("en-IN")} aura. Fully sweepable.`;

  // Precomputed here where the null-check narrowing applies, so the async handler only
  // closes over strings.
  const shareUrl = `${appOrigin()}/vs/${p1.username}/${p2.username}`;
  const shareText = `Aura duel: @${p1.username} (${aura1.toLocaleString("en-IN")}) vs @${p2.username} (${aura2.toLocaleString("en-IN")}) — winner ${draws ? "a draw" : `@${p1Wins ? p1.username : p2.username}`}.`;

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    playHapticPop();
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ text: shareText, url: shareUrl });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        toast.success("Duel scorecard copied.");
      } else {
        throw new Error("no share target");
      }
      playAuraGainSound();
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        toast.error("Couldn't share the scorecard.");
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/leaderboard"
        onClick={playHapticPop}
        className="mb-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Ranked ledger
      </Link>

      <header className="mb-8 text-center">
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-border">
          <Swords className="h-6 w-6 text-foreground" aria-hidden="true" />
        </span>
        <h1 className="font-display text-3xl leading-none text-foreground">Duel docket</h1>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {draws ? "Dead heat" : `Delta ${delta.toLocaleString("en-IN")} aura`}
        </p>
      </header>

      <div className="relative grid gap-4 md:grid-cols-2">
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 z-20 hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background font-mono text-[11px] font-bold text-muted-foreground md:flex"
        >
          VS
        </span>
        <DuelPlate profile={p1} winning={p1Wins} />
        <DuelPlate profile={p2} winning={!p1Wins && !draws} />
      </div>

      <Plate className="mt-5 p-5" rail={aura1 - aura2}>
        <Chip tone="brass">
          <Crown className="h-3 w-3" aria-hidden="true" />
          Ruling
        </Chip>
        <p className="mt-3 text-sm leading-relaxed text-foreground">{verdict}</p>
      </Plate>

      <PrimaryButton className="mt-6 w-full" onClick={handleShare} loading={sharing}>
        <Share2 className="h-4 w-4" aria-hidden="true" />
        Share scorecard
      </PrimaryButton>
    </div>
  );
}

function DuelPlate({ profile, winning }: { profile: DuelProfile; winning: boolean }) {
  const name = profile.display_name || profile.username;
  return (
    <Plate className={cn("p-5 text-center", winning && "ring-1 ring-[#1F6F5C]/40")}>
      {winning ? (
        <div className="mb-3 flex justify-center">
          <Chip tone="pos">Higher line</Chip>
        </div>
      ) : null}
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-secondary/40 text-lg font-bold text-foreground">
        {name.charAt(0).toUpperCase()}
      </span>
      <h2 className="mt-3 truncate text-sm font-semibold text-foreground">{name}</h2>
      <p className="text-[11px] text-muted-foreground">@{profile.username}</p>
      <div className="mt-3 flex justify-center">
        <Chip tone="lead" className="gap-2">
          <TierMark tier={profile.current_tier} size="sm" />
          <span className="normal-case tracking-normal">{profile.current_tier ?? "NPC"}</span>
        </Chip>
      </div>
      <div className="mt-4 border-t border-border/60 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Lifetime balance</p>
        <div className="mt-1.5 flex justify-center">
          <AuraNumber value={profile.total_aura ?? 0} size="lg" signed={false} />
        </div>
        <div className="mt-3 flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Flame className="h-3.5 w-3.5 text-[#B4442E] dark:text-[#E0795F]" aria-hidden="true" />
            {(profile.streak_days ?? 0)}d streak
          </span>
          {profile.is_premium ? (
            <Chip tone="brass" className="py-0.5">
              Premium
            </Chip>
          ) : null}
        </div>
      </div>
    </Plate>
  );
}
