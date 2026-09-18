"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  Sparkles,
  Crown,
  Flame,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
  ArrowLeft,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { AuraNumber } from "@/components/aura/aura-number";
import { EmojiMark, EmptyState, Plate, PrimaryButton } from "@/components/aura/primitives";
import { TierMark } from "@/components/aura/tier-mark";
import { useViewer } from "@/components/aura/hooks";
import { profileShareUrl } from "@/components/aura/mint";
import { playAuraGainSound, playHapticPop } from "@/lib/utils/sound";

type WrappedStats = {
  totalAura: number;
  eventsCount: number;
  streak: number;
  biggestW: { text: string; points: number } | null;
  biggestL: { text: string; points: number } | null;
  archetype: string;
  dominantCategory: string;
  tier: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  crush: "crush",
  school: "school",
  work: "work",
  gym: "gym",
  social: "social",
  family: "family",
  random: "random",
};

export default function WrappedClient() {
  const [stats, setStats] = useState<WrappedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const [busy, setBusy] = useState<"save" | "share" | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const slideRef = useRef<HTMLDivElement>(null);
  const viewer = useViewer();
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setError("Sign in to see your wrapped.");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("total_aura, current_tier, streak_days, username")
          .eq("id", user.id)
          .single();
        const p = profile as { total_aura?: number | null; current_tier?: string | null; streak_days?: number | null } | null;

        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: events } = await supabase
          .from("aura_events")
          .select("description, aura_points, category")
          .eq("user_id", user.id)
          .gte("created_at", since);

        const rows = (events ?? []) as { description?: string | null; aura_points?: number | null; category?: string | null }[];
        let net = 0;
        let biggestW: WrappedStats["biggestW"] = null;
        let biggestL: WrappedStats["biggestL"] = null;
        const categories: Record<string, number> = {};

        for (const row of rows) {
          const points = row.aura_points ?? 0;
          net += points;
          const category = row.category ?? "random";
          categories[category] = (categories[category] ?? 0) + 1;
          if (points > 0 && (!biggestW || points > biggestW.points)) {
            biggestW = { text: row.description ?? "", points };
          }
          if (points < 0 && (!biggestL || points < biggestL.points)) {
            biggestL = { text: row.description ?? "", points };
          }
        }

        let dominantCategory = "random";
        let max = 0;
        for (const [cat, count] of Object.entries(categories)) {
          if (count > max) {
            max = count;
            dominantCategory = cat;
          }
        }

        let archetype = "The Balanced Civilian";
        if (dominantCategory === "gym") archetype = "The Beast-Mode Gym Chad";
        else if (dominantCategory === "crush") archetype = "The Romantic Therapy Candidate";
        else if (dominantCategory === "work" || dominantCategory === "school") archetype = "The Corporate Sigma";
        else if (net > 25000) archetype = "The Untouchable Main Character";
        else if (net < 0) archetype = "The Down-Bad NPC";

        if (!cancelled) {
          setStats({
            totalAura: net,
            eventsCount: rows.length,
            streak: p?.streak_days ?? 0,
            biggestW,
            biggestL,
            archetype,
            dominantCategory,
            tier: p?.current_tier ?? "NPC",
          });
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Couldn't compose your wrapped. Retry in a moment.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, router]);

  const renderPng = useCallback(async (): Promise<string | null> => {
    if (!slideRef.current) return null;
    const { toPng } = await import("html-to-image");
    try {
      await document.fonts?.ready;
    } catch {
      /* fonts API unavailable */
    }
    return toPng(slideRef.current, { pixelRatio: 3, cacheBust: true, backgroundColor: "#0B0E0C" });
  }, []);

  async function handleSave() {
    if (busy) return;
    setBusy("save");
    try {
      const url = await renderPng();
      if (!url) throw new Error("no node");
      const a = document.createElement("a");
      a.href = url;
      a.download = `auramint-wrapped-${slide + 1}.png`;
      a.click();
      toast.success("Slide saved.");
    } catch {
      toast.error("Couldn't render the slide — take a screenshot instead.");
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    if (busy) return;
    setBusy("share");
    const username = viewer.username;
    const url = username ? profileShareUrl(username) : window.location.origin;
    const net = stats?.totalAura ?? 0;
    const text = `My aura this month: ${net > 0 ? "+" : ""}${net} across ${stats?.eventsCount ?? 0} moments. Archetype: ${stats?.archetype ?? "—"}.`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ text, url });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast.success("Copied to clipboard.");
      } else {
        throw new Error("no share target");
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        toast.error("Couldn't share — copy the text manually.");
      }
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-xl" aria-busy="true">
        <Plate className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Composing your wrapped</span>
        </Plate>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl">
        <Plate className="px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <PrimaryButton className="mt-4" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </PrimaryButton>
        </Plate>
      </div>
    );
  }

  if (!stats || stats.eventsCount === 0) {
    return (
      <div className="mx-auto max-w-xl pt-8">
        <EmptyState
          icon={<Sparkles className="h-6 w-6" aria-hidden="true" />}
          title="Nothing to wrap yet"
          description="Wrapped is a recap of the last 30 days. Mint at least three moments and come back."
          action={
            <PrimaryButton onClick={() => window.dispatchEvent(new CustomEvent("open-submit-modal"))}>
              Log a moment
            </PrimaryButton>
          }
        />
      </div>
    );
  }

  const slides = [
    {
      key: "intro",
      kicker: "Aura wrapped",
      content: (
        <div className="text-center">
          <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-[#C9A227]/40">
            <Crown className="h-7 w-7 text-[#8A6E14] dark:text-[#C9A227]" aria-hidden="true" />
          </span>
          <h2 className="font-display text-4xl leading-none text-foreground">Your month, minted</h2>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Last 30 days · {stats.eventsCount} moments
          </p>
        </div>
      ),
    },
    {
      key: "net",
      kicker: "Net aura",
      content: (
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Net this month</p>
          <div className="mt-3 flex justify-center">
            <AuraNumber value={stats.totalAura} size="hero" />
          </div>
          <div className="mt-5 flex items-center justify-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <Flame className="h-3.5 w-3.5 text-[#B4442E] dark:text-[#E0795F]" aria-hidden="true" />
              {stats.streak}-day streak
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border border-border/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <TierMark tier={stats.tier} size="sm" />
              {stats.tier}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "w",
      kicker: "Peak moment",
      content: (
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#16604F] dark:text-[#43B994]">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
            Biggest W
          </span>
          {stats.biggestW ? (
            <>
              <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-foreground">&ldquo;{stats.biggestW.text}&rdquo;</p>
              <div className="mt-4 flex justify-center">
                <AuraNumber value={stats.biggestW.points} size="xl" />
              </div>
            </>
          ) : (
            <p className="mt-6 text-sm italic text-muted-foreground">No wins logged this month.</p>
          )}
        </div>
      ),
    },
    {
      key: "l",
      kicker: "Hardest moment",
      content: (
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9E3A26] dark:text-[#E0795F]">
            <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
            Biggest L
          </span>
          {stats.biggestL ? (
            <>
              <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-foreground">&ldquo;{stats.biggestL.text}&rdquo;</p>
              <div className="mt-4 flex justify-center">
                <AuraNumber value={stats.biggestL.points} size="xl" />
              </div>
            </>
          ) : (
            <p className="mt-6 text-sm italic text-muted-foreground">No losses logged. Suspicious.</p>
          )}
        </div>
      ),
    },
    {
      key: "archetype",
      kicker: "Archetype",
      content: (
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <Crown className="h-3.5 w-3.5" aria-hidden="true" />
            Your archetype
          </span>
          <h3 className="mt-4 font-display text-2xl leading-tight text-foreground">{stats.archetype}</h3>
          <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
            Driven by {CATEGORY_LABEL[stats.dominantCategory] ?? stats.dominantCategory} moments.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <EmojiMark
              emoji={stats.dominantCategory === "gym" ? "💪" : stats.dominantCategory === "crush" ? "💕" : "👑"}
              className="text-3xl"
              label="archetype mark"
            />
            <span className="rounded-lg border border-border/70 bg-card p-1.5">
              <QRCodeSVG
                value={viewer.username ? profileShareUrl(viewer.username) : window.location.origin}
                size={56}
                bgColor="transparent"
                fgColor="hsl(var(--foreground))"
                level="L"
              />
            </span>
          </div>
        </div>
      ),
    },
  ];

  function next() {
    playHapticPop();
    if (slide < slides.length - 1) setSlide((s) => s + 1);
    else {
      playAuraGainSound();
      router.push("/dashboard");
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href="/dashboard"
        onClick={playHapticPop}
        className="mb-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Ledger
      </Link>

      <div ref={slideRef} className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-6 sm:p-8">
        {/* guilloche rosette band */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: `repeating-linear-gradient(45deg, #C9A227 0 1px, transparent 1px 10px)` }}
        />
        <div className="relative z-10">
          <div className="mb-6 flex gap-1" aria-hidden="true">
            {slides.map((_, i) => (
              <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                <span className={cn("block h-full bg-[#1F6F5C] transition-all duration-300", i <= slide ? "w-full" : "w-0")} />
              </span>
            ))}
          </div>

          <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {slides[slide].kicker} · serial {viewer.username ? `@${viewer.username}` : ""}
          </p>

          <div className="flex min-h-[34vh] items-center justify-center">
            <motion.div
              key={slides[slide].key}
              initial={reducedMotion ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.3 }}
              className="w-full"
            >
              {slides[slide].content}
            </motion.div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4">
            <button
              type="button"
              onClick={() => {
                playHapticPop();
                if (slide > 0) setSlide((s) => s - 1);
              }}
              disabled={slide === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back
            </button>
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {slide + 1}/{slides.length}
            </span>
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ background: "#1F6F5C", color: "#F7F4EC" }}
            >
              {slide === slides.length - 1 ? "Finish" : "Next"}
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy !== null}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border/70 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
          Save slide
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={busy !== null}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
          style={{ background: "#1F6F5C", color: "#F7F4EC" }}
        >
          {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
          Share
        </button>
      </div>
    </div>
  );
}
