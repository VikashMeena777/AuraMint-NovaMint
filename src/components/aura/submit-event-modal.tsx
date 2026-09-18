"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, Zap, Crown, ArrowRight, Flame } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/lib/ai/prompts";
import { submitAuraEvent } from "@/lib/actions/aura-actions";
import type { SubmitAuraResult } from "./types";
import { CelebrationEffect } from "./celebration-effect";
import { AuraNumber } from "./aura-number";
import { EmojiMark, Plate, PrimaryButton, Switch } from "./primitives";
import { TierMark } from "./tier-mark";
import { MintDialog } from "./mint-dialog";
import { usePlanLimits } from "./hooks";
import { MINT, tierName } from "./mint";
import { playAuraGainSound, playAuraLossSound, playHapticPop } from "@/lib/utils/sound";

/** Broadcast so the feed / daily report refresh after a successful mint. */
export const EVENT_MINTED_EVENT = "auramint:event-minted";
const LEGENDARY_THRESHOLD = 5000;

type CategoryValue = (typeof CATEGORIES)[number]["value"];

export function SubmitEventModal({ onEventSubmitted }: { onEventSubmitted?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CategoryValue>("random");
  const [vibeRoll, setVibeRoll] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitAuraResult | null>(null);
  const [limitsKey, setLimitsKey] = useState(0);
  const limits = usePlanLimits(limitsKey);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSubmittedRef = useRef(onEventSubmitted);

  useEffect(() => {
    onSubmittedRef.current = onEventSubmitted;
  });

  const resetState = useCallback(() => {
    setDescription("");
    setCategory("random");
    setVibeRoll(false);
    setResult(null);
  }, []);

  const open = useCallback(() => {
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
    setIsOpen(true);
    playHapticPop();
  }, []);

  // Two legacy event names exist for one concept — accept both so the bottom nav and the
  // command palette both work now that this modal is mounted once for the whole app.
  useEffect(() => {
    const onOpen = () => open();
    window.addEventListener("open-submit-modal", onOpen);
    window.addEventListener("open-aura-log-modal", onOpen);
    return () => {
      window.removeEventListener("open-submit-modal", onOpen);
      window.removeEventListener("open-aura-log-modal", onOpen);
    };
  }, [open]);

  // Clear the deferred reset if the component unmounts mid-close.
  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    []
  );

  function handleClose() {
    setIsOpen(false);
    playHapticPop();
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(resetState, 250);
  }

  async function handleSubmit() {
    if (submitting) return;
    const trimmed = description.trim();
    if (trimmed.length < 5) {
      toast.error("Tell us what happened — at least 5 characters.");
      return;
    }
    if (limits.ready && !limits.canSubmit) {
      toast.error("You have used today's free mint. Upgrade for unlimited events.");
      return;
    }

    playHapticPop();
    setSubmitting(true);
    try {
      const response = (await submitAuraEvent({
        description: trimmed,
        category,
        isPublic: true,
        vibeRoll,
      })) as SubmitAuraResult;

      if (response?.error) {
        toast.error(response.error);
        setLimitsKey((k) => k + 1);
        return;
      }
      if (!response?.success) {
        toast.error("Something went wrong while minting. Try again.");
        return;
      }

      const points = response.aura?.points ?? 0;
      if (points >= 0) playAuraGainSound();
      else playAuraLossSound();

      setResult(response);
      setLimitsKey((k) => k + 1);
      window.dispatchEvent(new CustomEvent(EVENT_MINTED_EVENT, { detail: { eventId: response.event?.id } }));
      onSubmittedRef.current?.();
    } catch {
      toast.error("Couldn't reach the mint. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const revealOpen = Boolean(result);
  const canSubmit = description.trim().length >= 5 && !(limits.ready && !limits.canSubmit);

  return (
    <>
      {/* Desktop strike button — the mobile entry point is the bottom nav Log action. */}
      <button
        type="button"
        onClick={open}
        className="fixed bottom-8 right-8 z-30 hidden items-center gap-2.5 rounded-xl border border-[#16564A] bg-[#1F6F5C] px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#F7F4EC] shadow-lg transition-colors hover:bg-[#16564A] lg:flex"
        id="desktop-submit-btn"
      >
        <Zap className="h-4 w-4" aria-hidden="true" />
        Log aura event
      </button>

      <MintDialog
        open={isOpen}
        onOpenChange={(next) => {
          if (!next) handleClose();
        }}
        title={revealOpen ? "Minted" : "What happened?"}
        description={
          revealOpen
            ? "Recorded in your ledger."
            : "Describe the moment. The assayer returns points, a verdict and a vibe tag."
        }
      >
        {!revealOpen ? (
          <>
            {/* Quota strip */}
            <Plate className="mb-5 px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {limits.isPremium ? "Premium mint" : "Free mint"}
                </span>
                <span className={cn("font-mono tabular-nums", limits.isPremium ? "text-[#8A6E14] dark:text-[#C9A227]" : "text-muted-foreground")}>
                  {limits.dailyEventsLimit === null
                    ? "unlimited today"
                    : `${limits.dailyEventsUsed}/${limits.dailyEventsLimit} today`}
                </span>
              </div>
              {limits.ready && !limits.canSubmit ? (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Daily limit reached.{" "}
                  <Link href="/premium" className="font-semibold text-[#16604F] underline dark:text-[#43B994]">
                    Go unlimited
                  </Link>
                  .
                </p>
              ) : null}
            </Plate>

            {/* Category */}
            <fieldset className="mb-5">
              <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Category
              </legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => {
                  const selected = category === cat.value;
                  const MetaIcon = cat.emoji;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setCategory(cat.value);
                        playHapticPop();
                      }}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                        selected
                          ? "border-[#1F6F5C] bg-[#1F6F5C]/10 text-foreground"
                          : "border-border/70 text-muted-foreground hover:border-[#1F6F5C]/30 hover:text-foreground"
                      )}
                    >
                      <EmojiMark emoji={MetaIcon} className="text-sm" label={cat.label} />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Moment */}
            <div className="mb-5">
              <label
                htmlFor="aura-event-description"
                className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                The moment
              </label>
              <textarea
                id="aura-event-description"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 280))}
                placeholder="Held the lift for the professor and he actually smiled back…"
                rows={4}
                maxLength={280}
                aria-describedby="aura-event-counter"
                className="w-full resize-none rounded-xl border border-border bg-secondary/20 p-4 text-sm text-foreground transition placeholder:text-muted-foreground/60 focus:border-[#1F6F5C]/60 focus:outline-none"
              />
              <p id="aura-event-counter" className="mt-1 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                <span className={cn(description.length > 250 && "text-[#9E3A26] dark:text-[#E0795F]")}>
                  {description.length}
                </span>
                /280
              </p>
            </div>

            {/* Vibe roll */}
            <div
              className={cn(
                "mb-5 rounded-xl border p-3.5 transition-colors",
                vibeRoll ? "border-[#C9A227]/40 bg-[#C9A227]/10" : "border-border/70"
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    Vibe roll
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Double or nothing. A fair coin decides: double the points, or lose them.
                  </p>
                </div>
                <Switch checked={vibeRoll} onCheckedChange={setVibeRoll} label="Toggle vibe roll double or nothing" />
              </div>
            </div>

            <PrimaryButton
              onClick={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
              className="w-full"
              id="calculate-aura-btn"
            >
              {submitting ? "Assaying your moment" : "Calculate my aura"}
            </PrimaryButton>
          </>
        ) : (
          <AuraReveal result={result as SubmitAuraResult} onClose={handleClose} />
        )}
      </MintDialog>
    </>
  );
}

function AuraReveal({ result, onClose }: { result: SubmitAuraResult; onClose: () => void }) {
  const reducedMotion = useReducedMotion();
  const points = result.aura?.points ?? 0;
  const isPositive = points >= 0;
  const isLegendary = Math.abs(points) >= LEGENDARY_THRESHOLD;
  const tier = tierName(result.newTier);
  const eventId = result.event?.id;

  return (
    <div className="relative text-center">
      {isLegendary ? (
        // Seeded from the event id → deterministic particles, no Math.random in render.
        <CelebrationEffect
          type={isPositive ? "confetti" : "skull"}
          seed={eventId ? eventId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) : points}
        />
      ) : null}

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.24 }}
        className="flex justify-center"
      >
        <EmojiMark emoji={result.aura?.emoji} label="verdict emoji" className="text-5xl" />
      </motion.div>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.28, delay: 0.12 }}
        className="mt-3"
      >
        <AuraNumber value={points} size="hero" animate />
      </motion.div>

      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">aura points</p>

      <motion.blockquote
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.28, delay: 0.24 }}
        className="mx-auto mt-4 max-w-sm border-l-2 pl-3 text-left text-sm italic leading-relaxed text-muted-foreground"
        style={{ borderColor: isPositive ? MINT.patinaBright : MINT.oxide }}
      >
        {result.aura?.verdict}
      </motion.blockquote>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.28, delay: 0.34 }}
        className="mt-4 flex flex-wrap items-center justify-center gap-2"
      >
        {result.aura?.vibe_tag ? (
          <span className="rounded-md border border-[#1F6F5C]/30 bg-[#1F6F5C]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">
            {result.aura.vibe_tag}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-2 rounded-md border border-border/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <TierMark tier={tier} size="sm" />
          {tier}
        </span>
      </motion.div>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.28, delay: 0.42 }}
        className="mt-5"
      >
        <Plate className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Total balance
            </span>
            <AuraNumber value={result.newTotalAura ?? 0} size="md" signed={false} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Flame className="h-3.5 w-3.5" aria-hidden="true" />
              {result.streak ?? 0}-day streak
            </span>
            {result.streakBonus ? (
              <span className="font-mono text-[11px] tabular-nums text-[#16604F] dark:text-[#43B994]">
                streak bonus +{result.streakBonus}
              </span>
            ) : null}
          </div>
        </Plate>
      </motion.div>

      <div className="mt-5 flex flex-col gap-2">
        <PrimaryButton onClick={onClose} className="w-full">
          Back to the ledger
          <Crown className="h-4 w-4" aria-hidden="true" />
        </PrimaryButton>
        {eventId ? (
          <Link
            href={`/event/${eventId}`}
            className="inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
          >
            View the public record
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
