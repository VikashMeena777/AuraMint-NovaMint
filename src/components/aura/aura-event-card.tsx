"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUp, ArrowDown, Share2, Rocket, Sparkles, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn, timeAgo } from "@/lib/utils";
import { reactToEvent, voteOnEvent, boostEvent } from "@/lib/actions/aura-actions";
import type { AuraEvent, BoostResult, EventProfile, InteractionResult } from "./types";
import { AuraNumber } from "./aura-number";
import { Chip, EmojiMark, Plate } from "./primitives";
import { TierMark } from "./tier-mark";
import { ShareCardModal } from "./share-card-modal";
import { categoryMeta, eventShareUrl, formatSignedAura, MINT, REACTIONS, TONE } from "./mint";
import { playHapticPop } from "@/lib/utils/sound";

const LEGENDARY_THRESHOLD = 5000;

function asProfile(value: AuraEvent["profiles"]): EventProfile | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function AuraEventCard({
  event,
  index = 0,
  isOwner = false,
  isPremium = false,
}: {
  event: AuraEvent;
  index?: number;
  isOwner?: boolean;
  /** Viewer's premium state — used only for the share-card treatment of their own event. */
  isPremium?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const [reactions, setReactions] = useState<Record<string, number>>(event.reaction_counts ?? {});
  const [upvotes, setUpvotes] = useState(event.upvotes ?? 0);
  const [downvotes, setDownvotes] = useState(event.downvotes ?? 0);
  const [activeReaction, setActiveReaction] = useState<string | null>(event.viewer_reaction ?? null);
  const [userVote, setUserVote] = useState<1 | -1 | null>(event.viewer_vote ?? null);
  const [busyReaction, setBusyReaction] = useState<string | null>(null);
  const [busyVote, setBusyVote] = useState<0 | 1 | -1 | null>(null);
  const [boosting, setBoosting] = useState(false);
  const [isBoosted, setIsBoosted] = useState(Boolean(event.is_boosted));
  const [showShareCard, setShowShareCard] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const profile = asProfile(event.profiles);
  const points = Number.isFinite(event.aura_points) ? event.aura_points : 0;
  const isPositive = points >= 0;
  const isLegendary = Math.abs(points) >= LEGENDARY_THRESHOLD;
  const category = categoryMeta(event.category);
  const CategoryIcon = category.icon;
  const subjectPremium = isOwner ? isPremium : Boolean(profile?.is_premium);

  async function handleReaction(type: string) {
    if (busyReaction) return;
    playHapticPop();
    setBusyReaction(type);
    try {
      const result = (await reactToEvent(event.id, type)) as InteractionResult;
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      if (result.action === "removed") {
        setActiveReaction(null);
        setReactions((prev) => ({ ...prev, [type]: Math.max(0, (prev[type] ?? 0) - 1) }));
      } else {
        setReactions((prev) => {
          const next = { ...prev };
          if (activeReaction && activeReaction !== type) next[activeReaction] = Math.max(0, (next[activeReaction] ?? 0) - 1);
          next[type] = (next[type] ?? 0) + 1;
          return next;
        });
        setActiveReaction(type);
      }
    } catch {
      toast.error("Couldn't save that reaction. Try again.");
    } finally {
      setBusyReaction(null);
    }
  }

  async function handleVote(value: 1 | -1) {
    if (busyVote !== null) return;
    playHapticPop();
    setBusyVote(value);
    try {
      const result = (await voteOnEvent(event.id, value)) as InteractionResult;
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      if (result.action === "removed") {
        if (value === 1) setUpvotes((v) => Math.max(0, v - 1));
        else setDownvotes((v) => Math.max(0, v - 1));
        setUserVote(null);
      } else {
        if (userVote === 1) setUpvotes((v) => Math.max(0, v - 1));
        if (userVote === -1) setDownvotes((v) => Math.max(0, v - 1));
        if (value === 1) setUpvotes((v) => v + 1);
        else setDownvotes((v) => v + 1);
        setUserVote(value);
      }
    } catch {
      toast.error("Couldn't record that vote. Try again.");
    } finally {
      setBusyVote(null);
    }
  }

  async function handleBoost() {
    if (isBoosted || boosting) return;
    setBoosting(true);
    try {
      const result = (await boostEvent(event.id)) as BoostResult;
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      setIsBoosted(true);
      toast.success("Event boosted — it now leads the ledger.");
    } catch {
      toast.error("Couldn't boost that event. Try again.");
    } finally {
      setBoosting(false);
    }
  }

  async function handleShare() {
    playHapticPop();
    const text = `${event.ai_emoji ?? ""} ${formatSignedAura(points)} aura\n\n"${event.description}"\n\n${event.ai_verdict ?? ""}\n\n— AuraMint`;
    const url = eventShareUrl(event.id);
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
    }
  }

  const authorHref = profile?.username ? `/profile/${profile.username}` : null;
  const authorName = profile?.display_name || profile?.username || "Anonymous";

  return (
    <>
      <motion.article
        initial={reducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.32, ease: "easeOut", delay: Math.min(index, 8) * 0.03 }}
      >
        <Plate
          rail={points}
          className={cn("p-5", isLegendary && "ring-1 ring-[#C9A227]/40")}
        >
          {/* Boosted flag */}
          {isBoosted ? (
            <div className="mb-3">
              <Chip tone="brass">
                <Rocket className="h-3 w-3" aria-hidden="true" />
                Boosted
              </Chip>
            </div>
          ) : null}

          {/* Header: author (link) + hallmark, timestamp, category */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-secondary/40 text-sm font-bold text-foreground">
                {authorName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {authorHref ? (
                    <Link href={authorHref} className="truncate text-sm font-semibold text-foreground hover:underline">
                      {authorName}
                    </Link>
                  ) : (
                    <span className="truncate text-sm font-semibold text-foreground">{authorName}</span>
                  )}
                  <TierMark tier={profile?.current_tier} size="sm" />
                </div>
                <span className="text-[11px] text-muted-foreground" suppressHydrationWarning>
                  {timeAgo(event.created_at)}
                </span>
              </div>
            </div>

            <Chip tone="lead" className="shrink-0">
              <CategoryIcon className="h-3 w-3" aria-hidden="true" />
              {category.label}
            </Chip>
          </div>

          {/* Moment */}
          <p className={cn("mt-4 text-sm leading-relaxed text-foreground/95", !expanded && "line-clamp-3")}>
            {event.description}
          </p>
          {event.description.length > 160 ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
            >
              {expanded ? "Show less" : "Read more"}
              <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
            </button>
          ) : null}

          {/* Struck value */}
          <div className="mt-4 flex items-baseline gap-3">
            <AuraNumber value={points} size="lg" animate={index < 3} />
            <EmojiMark emoji={event.ai_emoji} label="aura verdict emoji" className="text-2xl" />
          </div>

          {/* Verdict microprint */}
          {event.ai_verdict ? (
            <blockquote
              className="mt-3 border-l-2 pl-3 text-xs italic leading-relaxed text-muted-foreground"
              style={{ borderColor: isPositive ? MINT.patinaBright : MINT.oxide }}
            >
              {event.ai_verdict}
            </blockquote>
          ) : null}

          {/* Vibe tag */}
          {event.ai_vibe_tag ? (
            <div className="mt-3">
              <Chip tone="pos" className="lowercase">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                {event.ai_vibe_tag}
              </Chip>
            </div>
          ) : null}

          {/* Reactions: stamped tokens */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {REACTIONS.map((r) => {
              const count = reactions[r.type] ?? 0;
              const active = activeReaction === r.type;
              return (
                <button
                  key={r.type}
                  type="button"
                  onClick={() => handleReaction(r.type)}
                  disabled={busyReaction !== null}
                  aria-pressed={active}
                  aria-label={`React ${r.label} (${count})`}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60",
                    active
                      ? "border-[#1F6F5C]/50 bg-[#1F6F5C]/10 text-foreground"
                      : "border-border/70 bg-transparent text-muted-foreground hover:border-[#1F6F5C]/30 hover:text-foreground"
                  )}
                >
                  <EmojiMark emoji={r.emoji} label={r.label} className="text-sm" />
                  <span className="font-mono tabular-nums">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Footer: W/L + actions */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleVote(1)}
                disabled={busyVote !== null}
                aria-pressed={userVote === 1}
                aria-label={`Vote W (${upvotes})`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors disabled:opacity-60",
                  userVote === 1 ? TONE.posBgSoft : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                W
                <span className="font-mono tabular-nums">{upvotes}</span>
              </button>
              <button
                type="button"
                onClick={() => handleVote(-1)}
                disabled={busyVote !== null}
                aria-pressed={userVote === -1}
                aria-label={`Vote L (${downvotes})`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors disabled:opacity-60",
                  userVote === -1 ? TONE.negBgSoft : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                L
                <span className="font-mono tabular-nums">{downvotes}</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  playHapticPop();
                  setShowShareCard(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Card
              </button>
              {isOwner && !isBoosted ? (
                <button
                  type="button"
                  onClick={handleBoost}
                  disabled={boosting}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors disabled:opacity-60",
                    TONE.brassBgSoft
                  )}
                >
                  <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
                  {boosting ? "Boosting" : "Boost"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground"
              >
                <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                Share
              </button>
            </div>
          </div>
        </Plate>
      </motion.article>

      <ShareCardModal
        isOpen={showShareCard}
        onClose={() => setShowShareCard(false)}
        data={{
          description: event.description,
          aura_points: points,
          ai_verdict: event.ai_verdict,
          ai_emoji: event.ai_emoji,
          ai_vibe_tag: event.ai_vibe_tag,
          username: profile?.username || "anonymous",
          tier: profile?.current_tier || "NPC",
          event_id: event.id,
          isPremium: subjectPremium,
        }}
      />
    </>
  );
}
