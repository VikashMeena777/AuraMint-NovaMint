"use client";

import { useState, useEffect, Suspense } from "react";
import { motion } from "framer-motion";
import { Crown, Sparkles, Zap, Shield, Palette, Ban, Check, Loader2 } from "lucide-react";
import { createPremiumOrder } from "@/lib/actions/payment-actions";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

const features = [
  { icon: Zap, label: "Unlimited aura events/day", free: "5/day", premium: "Unlimited" },
  { icon: Sparkles, label: "AI verdict quality", free: "Standard", premium: "Extra savage & dramatic" },
  { icon: Crown, label: "Leaderboard access", free: "Global only", premium: "Global + Friends" },
  { icon: Palette, label: "Aura themes", free: "Default", premium: "6 exclusive themes" },
  { icon: Shield, label: "Share cards", free: "With watermark", premium: "No watermark + custom" },
  { icon: Ban, label: "Ads", free: "Banner ads", premium: "Ad-free" },
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
      // Load Cashfree checkout
      const cashfreeEnv = process.env.NEXT_PUBLIC_CASHFREE_ENV === "production" ? "production" : "sandbox";
      try {
        const { load } = await import("@cashfreepayments/cashfree-js");
        const cashfree = await load({ mode: cashfreeEnv });
        await cashfree.checkout({
          paymentSessionId: result.paymentSessionId,
          redirectTarget: "_self",
        });
      } catch {
        // Fallback: redirect to Cashfree hosted page
        toast.error("Could not load payment. Please try again.");
      }
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Success State */}
      {status === "success" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 glass glow-gold p-6 text-center"
        >
          <span className="text-4xl">👑</span>
          <h2 className="heading mt-2 text-xl grad-gold">You&apos;re Premium!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            All features unlocked. Enjoy the full AuraMint experience.
          </p>
        </motion.div>
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 aura-orb">
          <Crown className="h-8 w-8 text-primary" />
        </div>
        <h1 className="heading text-3xl">
          <span className="grad-text">AuraMint+</span>
        </h1>
        <p className="mt-2 text-muted-foreground">
          Unlock your full aura potential. Go premium.
        </p>
      </motion.div>

      {/* Pricing Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass glow-gold overflow-hidden"
      >
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-6 text-center">
          <p className="text-sm font-medium text-muted-foreground">Monthly</p>
          <div className="mt-1 flex items-baseline justify-center gap-1">
            <span className="mono text-4xl font-black text-primary">
              ₹199
            </span>
            <span className="text-sm text-muted-foreground">/month</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">or $4.99/month for international</p>
        </div>

        {/* Feature Comparison */}
        <div className="p-6">
          <div className="space-y-3">
            {features.map((feature, i) => (
              <motion.div
                key={feature.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="flex items-center gap-3 rounded-xl bg-secondary/30 p-3"
              >
                <feature.icon className="h-5 w-5 shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{feature.label}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground line-through">{feature.free}</span>
                    <span className="text-primary font-semibold">→ {feature.premium}</span>
                  </div>
                </div>
                <Check className="h-4 w-4 shrink-0 text-emerald-500" />
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={handleUpgrade}
            disabled={loading || status === "success"}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-sm font-bold text-primary-foreground transition-all hover:brightness-110 glow-brand disabled:opacity-50"
            id="upgrade-premium-btn"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : status === "success" ? (
              <>
                <Check className="h-5 w-5" />
                Already Premium
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Upgrade to Premium
              </>
            )}
          </button>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            Cancel anytime. No questions asked.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function PremiumPage() {
  return (
    <Suspense>
      <PremiumContent />
    </Suspense>
  );
}
