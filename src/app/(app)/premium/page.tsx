"use client";

import { useState, useEffect, Suspense } from "react";
import { motion } from "framer-motion";
import { Crown, Sparkles, Zap, Shield, Palette, Ban, Check, Loader2, Rocket, BarChart3, Medal, Trophy } from "lucide-react";
import { createPremiumOrder } from "@/lib/actions/payment-actions";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

const features = [
  { icon: Zap, label: "Aura events per day", free: "3/day", premium: "Unlimited" },
  { icon: Sparkles, label: "AI verdict quality", free: "Standard", premium: "Extra savage & dramatic" },
  { icon: Rocket, label: "Event boosts", free: "0", premium: "5/month" },
  { icon: Trophy, label: "Priority leaderboards", free: "Basic", premium: "Priority + Crown badge" },
  { icon: Shield, label: "Viral share cards", free: "Standard", premium: "Premium holographic" },
  { icon: BarChart3, label: "Detailed analytics", free: "Not available", premium: "Full insights dashboard" },
  { icon: Medal, label: "Custom badges", free: "Locked", premium: "All unlockable" },
  { icon: Palette, label: "Aura themes", free: "Default", premium: "6 exclusive themes" },
  { icon: Ban, label: "Ads", free: "Banner ads", premium: "Ad-free experience" },
  { icon: Crown, label: "Early feature access", free: "No", premium: "First to try new features" },
];

function PremiumContent() {
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const status = searchParams.get("status");

  useEffect(() => {
    if (status === "success") {
      toast.success("Welcome to AuraMint+ Premium! 👑✨");
    } else if (status === "FAILED") {
      toast.error("Payment failed. Please try again.");
    }
  }, [status]);

  async function handleUpgrade() {
    setLoading(true);
    const result = await createPremiumOrder();

    if (result.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }

    if (result.paymentSessionId) {
      const cashfreeEnv = process.env.NEXT_PUBLIC_CASHFREE_ENV === "production" ? "production" : "sandbox";
      try {
        const { load } = await import("@cashfreepayments/cashfree-js");
        const cashfree = await load({ mode: cashfreeEnv });
        await cashfree.checkout({
          paymentSessionId: result.paymentSessionId,
          redirectTarget: "_self",
        });
      } catch {
        toast.error("Could not load payment interface. Please try again.");
      }
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-xl">
      {/* Premium upgrade successful state banner */}
      {status === "success" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 glass glow-gold p-6 text-center border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent rounded-3xl"
        >
          <Crown className="h-10 w-10 text-yellow-400 mx-auto mb-3 animate-pulse" />
          <h2 className="heading text-xl grad-gold">You&apos;re Premium!</h2>
          <p className="mt-1.5 text-xs text-muted-foreground">
            All premium credentials have been unlocked on your profile. Keep flexing!
          </p>
        </motion.div>
      )}

      {/* Header Description */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/5 shadow-md aura-orb">
          <Crown className="h-8 w-8 text-primary" />
        </div>
        <h1 className="heading text-3xl">
          <span className="grad-text">AuraMint+</span>
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed px-4">
          Unlock your complete cosmic energy potentials. Acquire absolute God Mode parameters.
        </p>
      </motion.div>

      {/* Redesigned upgrade layout pricing comparisons */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass glow-gold overflow-hidden rounded-[2.25rem] border border-primary/25 shadow-2xl relative"
      >
        {/* Glow background visuals */}
        <div className="absolute -right-24 -top-24 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="bg-gradient-to-br from-primary/10 to-accent/5 p-8 text-center border-b border-border/30">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/10 inline-block mb-3 shadow-inner">Monthly Plan</span>
          <div className="flex items-baseline justify-center gap-1.5 mt-2">
            <span className="heading text-5xl font-black text-primary" style={{ fontFamily: "var(--font-display)" }}>
              ₹99
            </span>
            <span className="text-xs font-bold text-muted-foreground/80 uppercase tracking-wide">/ Month</span>
          </div>
          <p className="mt-2 text-[10px] uppercase font-bold tracking-widest text-muted-foreground/50">or $1.99/month for international fans</p>
        </div>

        {/* Feature comparison table rows list */}
        <div className="p-6 sm:p-8">
          <div className="space-y-3">
            {features.map((feature, i) => (
              <motion.div
                key={feature.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                className="flex items-center gap-4 rounded-2xl bg-secondary/20 border border-border/10 p-3.5 hover:border-primary/10 transition-colors"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card border border-border/35 text-primary shadow-sm">
                  <feature.icon className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold leading-tight text-foreground">{feature.label}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/45 line-through">{feature.free}</span>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">→ {feature.premium}</span>
                  </div>
                </div>
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Primary Action upgrade Button */}
          <button
            onClick={handleUpgrade}
            disabled={loading || status === "success"}
            className="mt-8 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-primary px-5 py-4.5 text-xs font-extrabold uppercase tracking-wider text-primary-foreground transition-all hover:scale-[1.01] hover:brightness-110 shadow-lg glow-brand disabled:opacity-50"
            id="upgrade-premium-btn"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : status === "success" ? (
              <>
                <Check className="h-5 w-5" />
                <span>Already Premium</span>
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                <span>Upgrade to Premium</span>
              </>
            )}
          </button>

          <p className="mt-4 text-center text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/45">
            Cancel anytime. No questions asked.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function PremiumPage() {
  return (
    <Suspense
      fallback={
        <div className="glass noise relative mx-auto w-full max-w-md p-8 animate-pulse border border-border/40">
          <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-muted/60" />
          <div className="h-8 w-44 rounded bg-muted/50 mx-auto mb-4" />
          <div className="h-64 w-full rounded-3xl bg-muted/30" />
        </div>
      }
    >
      <PremiumContent />
    </Suspense>
  );
}
