"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Zap, Crown } from "lucide-react";
import { CelebrationEffect } from "@/components/aura/celebration-effect";
import { CATEGORIES } from "@/lib/ai/prompts";
import { submitAuraEvent } from "@/lib/actions/aura-actions";
import { toast } from "sonner";
import { cn, formatAuraPoints } from "@/lib/utils";
import { PremiumIcon } from "@/components/aura/premium-icon";
import { playHapticPop, playAuraGainSound, playAuraLossSound } from "@/lib/utils/sound";

type AuraResult = {
  event: {
    id: string;
    description: string;
    aura_points: number;
    ai_verdict: string;
    ai_vibe_tag: string;
    ai_emoji: string;
  };
  aura: { points: number; verdict: string; vibe_tag: string; emoji: string };
  newTotalAura: number;
  newTier: string;
  streakBonus: number;
  streak: number;
};

export function SubmitEventModal({
  onEventSubmitted,
}: {
  onEventSubmitted?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"crush" | "school" | "work" | "gym" | "social" | "family" | "random">("random");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuraResult | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const [vibeRoll, setVibeRoll] = useState(false);

  // Listen for mobile bottom nav open event
  useEffect(() => {
    function handleOpen() {
      setIsOpen(true);
      playHapticPop();
    }
    window.addEventListener("open-submit-modal", handleOpen);
    return () => window.removeEventListener("open-submit-modal", handleOpen);
  }, []);

  function resetState() {
    setDescription("");
    setCategory("random");
    setResult(null);
    setShowReveal(false);
    setVibeRoll(false);
  }

  function handleClose() {
    setIsOpen(false);
    playHapticPop();
    setTimeout(resetState, 300);
  }

  async function handleSubmit() {
    if (description.length < 5) {
      toast.error("Tell us what happened! (at least 5 characters)");
      return;
    }

    playHapticPop();
    setLoading(true);
    const response = await submitAuraEvent({
      description,
      category,
      isPublic: true,
      vibeRoll,
    });

    setLoading(false);

    if (response.error) {
      toast.error(response.error);
      return;
    }

    if (response.success) {
      const res = response as AuraResult;
      const points = res.aura?.points ?? 0;
      if (points >= 0) {
        playAuraGainSound();
      } else {
        playAuraLossSound();
      }
      setResult(res);
      setShowReveal(true);
      onEventSubmitted?.();
    }
  }

  return (
    <>
      {/* Desktop FAB Button overlay */}
      <button
        onClick={() => { setIsOpen(true); playHapticPop(); }}
        className="fixed bottom-8 right-8 z-30 hidden items-center gap-3.5 rounded-2xl bg-primary px-7 py-4.5 text-xs font-extrabold uppercase tracking-wider text-primary-foreground shadow-2xl transition-all hover:scale-105 active:scale-95 lg:flex glow-brand border border-primary/20"
        id="desktop-submit-btn"
      >
        <Zap className="h-5 w-5 animate-pulse" />
        Log Aura Event
      </button>

      {/* Modal Overlay background */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center p-4"
            onClick={(e) => e.target === e.currentTarget && handleClose()}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="relative w-full max-w-lg rounded-t-[2rem] bg-card p-7 shadow-2xl border border-border/40 sm:rounded-[2rem] overflow-hidden"
            >
              {/* Glow effects inside modal */}
              <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

              {/* Close */}
              <button
                onClick={handleClose}
                className="absolute right-5 top-5 rounded-xl border border-border bg-card/40 p-2.5 text-muted-foreground hover:text-foreground transition"
              >
                <X className="h-4.5 w-4.5" />
              </button>

              {!showReveal ? (
                <>
                  {/* Header Title */}
                  <div className="mb-6 mt-2">
                    <h2 className="heading text-xl tracking-tight leading-none">
                      What Happened? ⚡
                    </h2>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Tell the AI your moment and watch your aura values change
                    </p>
                  </div>

                  {/* Category Chips Selection */}
                  <div className="mb-5">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
                      Category
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat.value}
                          onClick={() => { setCategory(cat.value); playHapticPop(); }}
                          className={cn(
                            "rounded-2xl px-4 py-2 text-xs font-bold transition-all border flex items-center gap-1.5",
                            category === cat.value
                              ? "bg-primary border-primary/20 text-primary-foreground shadow-sm"
                              : "bg-secondary/40 border-transparent text-muted-foreground hover:bg-secondary/80"
                          )}
                        >
                          <PremiumIcon emoji={cat.emoji} className="h-3.5 w-3.5" />
                          <span>{cat.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Description Input Text Box */}
                  <div className="mb-6">
                    <textarea
                      value={description}
                      onChange={(e) =>
                        setDescription(e.target.value.slice(0, 280))
                      }
                      placeholder="e.g., Held the lift for college professor and he actually smiled back..."
                      rows={3}
                      className="w-full resize-none rounded-2xl border border-border bg-secondary/15 p-4 text-xs sm:text-sm transition placeholder:text-muted-foreground/45 focus:border-primary/50 focus:bg-secondary/35 focus:outline-none"
                      autoFocus
                    />
                    <p className="mt-1 text-right text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                      <span
                        className={cn(
                          description.length > 250 && "text-destructive"
                        )}
                      >
                        {description.length}
                      </span>
                    </p>
                  </div>

                  {/* Vibe Roll Double or Nothing Option */}
                  <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5 leading-none">
                        <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                        Aura Vibe Roll Gamble
                      </p>
                      <p className="text-[10px] leading-relaxed text-muted-foreground mt-1.5">
                        Double or Nothing (50% chance). Win double aura or lose it all! 🎲
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setVibeRoll(!vibeRoll); playHapticPop(); }}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                        vibeRoll ? "bg-primary" : "bg-secondary"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                          vibeRoll ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>

                  {/* Submit Trigger Action */}
                  <button
                    onClick={handleSubmit}
                    disabled={loading || description.length < 5}
                    className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-primary px-5 py-4.5 text-xs font-extrabold uppercase tracking-wider text-primary-foreground transition-all hover:brightness-110 shadow-lg glow-brand disabled:opacity-50"
                    id="calculate-aura-btn"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2.5">
                        <div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        <span>Calculating Aura Impact...</span>
                      </div>
                    ) : (
                      <>
                        <Sparkles className="h-4.5 w-4.5" />
                        <span>Calculate My Aura</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                /* Aura Reveal Results Card */
                result && (
                  <AuraReveal
                    result={result}
                    onClose={handleClose}
                  />
                )
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function AuraReveal({
  result,
  onClose,
}: {
  result: AuraResult;
  onClose: () => void;
}) {
  const isPositive = result.aura.points >= 0;
  const isLegendary = Math.abs(result.aura.points) >= 5000;

  return (
    <div className="text-center py-4 relative">
      {/* Confetti particle elements based on scoring value */}
      {isLegendary && (
        <CelebrationEffect type={isPositive ? "confetti" : "skull"} />
      )}
      
      {/* Emoji graphic */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", delay: 0.1, stiffness: 200 }}
        className="mb-3 flex justify-center select-none"
      >
        <PremiumIcon emoji={result.aura.emoji} className="h-14 w-14" />
      </motion.div>

      {/* Saturated Aura points reveal */}
      <motion.div
        initial={{ scale: 0.5, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", delay: 0.35, stiffness: 220 }}
        className={cn(
          "heading text-5xl sm:text-6xl font-black tracking-tight leading-none grad-text",
          isPositive ? "text-emerald-400" : "text-red-400"
        )}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {isPositive ? "+" : ""}
        {formatAuraPoints(result.aura.points)}
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
        className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.25em] text-muted-foreground/60"
      >
        aura points
      </motion.p>

      {/* Savagely Quoted Verdict */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75 }}
        className="mt-5 mx-2 rounded-2xl bg-secondary/20 border border-border/30 p-4"
      >
        <p className="text-xs sm:text-sm italic leading-relaxed text-muted-foreground">
          &ldquo;{result.aura.verdict}&rdquo;
        </p>
      </motion.div>

      {/* Dynamic Vibe Tag */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.95 }}
        className="mt-4"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 border border-accent/20 px-4 py-2 text-xs font-extrabold uppercase tracking-widest text-accent">
          <Sparkles className="h-3.5 w-3.5" />
          {result.aura.vibe_tag}
        </span>
      </motion.div>

      {/* Progress & Stat Pill */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.15 }}
        className="mt-6 rounded-2xl border border-border/30 bg-secondary/15 p-4"
      >
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/60">Total Aura Balance</p>
        <p className="heading text-xl font-bold mt-1 tracking-tight leading-none text-primary">
          {formatAuraPoints(result.newTotalAura)}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mt-1">
          {result.newTier} {result.streakBonus > 0 && `(Streak Bonus +${result.streakBonus}!)`}
        </p>
      </motion.div>

      {/* Close Action Trigger */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.35 }}
        onClick={onClose}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-xs font-extrabold uppercase tracking-wider text-primary-foreground shadow-lg transition hover:brightness-110 active:scale-98"
      >
        <span>Nice! Back to Feed</span>
        <Crown className="h-4 w-4" />
      </motion.button>
    </div>
  );
}
