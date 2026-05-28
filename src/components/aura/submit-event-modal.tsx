"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Zap } from "lucide-react";
import { CATEGORIES } from "@/lib/ai/prompts";
import { submitAuraEvent } from "@/lib/actions/aura-actions";
import { toast } from "sonner";
import { cn, formatAuraPoints } from "@/lib/utils";

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

  // Listen for mobile bottom nav open event
  useEffect(() => {
    function handleOpen() {
      setIsOpen(true);
    }
    window.addEventListener("open-submit-modal", handleOpen);
    return () => window.removeEventListener("open-submit-modal", handleOpen);
  }, []);

  function resetState() {
    setDescription("");
    setCategory("random");
    setResult(null);
    setShowReveal(false);
  }

  function handleClose() {
    setIsOpen(false);
    setTimeout(resetState, 300);
  }

  async function handleSubmit() {
    if (description.length < 5) {
      toast.error("Tell us what happened! (at least 5 characters)");
      return;
    }

    setLoading(true);
    const response = await submitAuraEvent({
      description,
      category,
      isPublic: true,
    });

    setLoading(false);

    if (response.error) {
      toast.error(response.error);
      return;
    }

    if (response.success) {
      setResult(response as AuraResult);
      setShowReveal(true);
      onEventSubmitted?.();
    }
  }

  return (
    <>
      {/* Desktop FAB */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 z-30 hidden items-center gap-2 rounded-2xl bg-primary px-6 py-4 text-sm font-bold text-primary-foreground shadow-2xl transition-all hover:scale-105 lg:flex glow-brand"
        id="desktop-submit-btn"
      >
        <Zap className="h-5 w-5" />
        Log Aura Event
      </button>

      {/* Modal Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
            onClick={(e) => e.target === e.currentTarget && handleClose()}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg rounded-t-3xl bg-card p-6 shadow-2xl sm:rounded-3xl sm:m-4"
            >
              {/* Close */}
              <button
                onClick={handleClose}
                className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-secondary"
              >
                <X className="h-5 w-5" />
              </button>

              {!showReveal ? (
                <>
                  {/* Header */}
                  <div className="mb-6">
                    <h2 className="heading text-xl">
                      What happened? ⚡
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Describe the moment and AI will rate your aura impact
                    </p>
                  </div>

                  {/* Category Picker */}
                  <div className="mb-4">
                    <label className="mb-2 block text-sm font-medium">
                      Category
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat.value}
                          onClick={() => setCategory(cat.value)}
                          className={cn(
                            "rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                            category === cat.value
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                          )}
                        >
                          {cat.emoji} {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Text Input */}
                  <div className="mb-6">
                    <textarea
                      value={description}
                      onChange={(e) =>
                        setDescription(e.target.value.slice(0, 280))
                      }
                      placeholder="e.g., Walked past crush without tripping..."
                      rows={3}
                      className="w-full resize-none rounded-xl border border-input bg-background p-4 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                      autoFocus
                    />
                    <p className="mt-1 text-right text-xs text-muted-foreground">
                      <span
                        className={cn(
                          description.length > 250 && "text-destructive"
                        )}
                      >
                        {description.length}
                      </span>
                      /280
                    </p>
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmit}
                    disabled={loading || description.length < 5}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50 glow-brand"
                    id="calculate-aura-btn"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        Calculating your aura...
                      </div>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Calculate My Aura
                      </>
                    )}
                  </button>
                </>
              ) : (
                /* Aura Reveal */
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
    <div className="text-center py-4">
      {/* Emoji burst */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", delay: 0.1 }}
        className="mb-4 text-6xl"
      >
        {result.aura.emoji}
      </motion.div>

      {/* Points */}
      <motion.div
        initial={{ scale: 0, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", delay: 0.3, stiffness: 200 }}
        className={cn(
          "mono text-5xl font-black tracking-tighter",
          isPositive ? "text-emerald-500" : "text-red-500"
        )}
      >
        {formatAuraPoints(result.aura.points)}
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-1 text-sm font-medium text-muted-foreground"
      >
        aura points
      </motion.p>

      {/* Verdict */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="mt-4 text-sm italic text-muted-foreground px-4"
      >
        &ldquo;{result.aura.verdict}&rdquo;
      </motion.p>

      {/* Vibe Tag */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.9 }}
        className="mt-4"
      >
        <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-4 py-1.5 text-sm font-semibold text-accent">
          <Sparkles className="h-3.5 w-3.5" />
          {result.aura.vibe_tag}
        </span>
      </motion.div>

      {/* New Total */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
        className="mt-6 rounded-xl bg-secondary/50 p-3"
      >
        <p className="text-xs text-muted-foreground">Total Aura</p>
        <p className="mono text-lg font-bold">
          {formatAuraPoints(result.newTotalAura)}
        </p>
        <p className="text-xs text-muted-foreground">
          {result.newTier} {result.streakBonus > 0 && `(+${result.streakBonus} streak bonus!)`}
        </p>
      </motion.div>

      {/* Close */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3 }}
        onClick={onClose}
        className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90"
      >
        Nice! Back to Feed 👑
      </motion.button>
    </div>
  );
}
