"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Crown, Sparkles, Check, ShieldCheck, Minus, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createPremiumOrder } from "@/lib/actions/payment-actions";
// Single source of truth for the free quota — the same constant the submit action enforces,
// so the certificate can never advertise a different number than the ledger applies.
import { FREE_DAILY_EVENT_LIMIT } from "@/lib/actions/plan-constants";
import { usePlanLimits, useViewer } from "@/components/aura/hooks";
import { Chip, Plate, PrimaryButton } from "@/components/aura/primitives";
import { TONE } from "@/components/aura/mint";
import { playPremiumUpgradeSound } from "@/lib/utils/sound";

type PaymentState = "idle" | "success" | "failed" | "pending" | "cancelled";

function normaliseStatus(raw: string | null): PaymentState {
  const value = (raw ?? "").toLowerCase();
  if (value === "success" || value === "paid") return "success";
  if (value === "pending" || value === "processing" || value === "active") return "pending";
  if (value === "cancelled" || value === "canceled" || value === "user_dropped") return "cancelled";
  if (value === "failed" || value === "failure" || value === "error") return "failed";
  return "idle";
}

const FEATURES: { label: string; free: string; premium: string }[] = [
  { label: "Aura events per day", free: `${FREE_DAILY_EVENT_LIMIT} / day`, premium: "Unlimited" },
  { label: "AI verdict quality", free: "Standard", premium: "Sharpest, most dramatic" },
  { label: "Event boosts", free: "None", premium: "5 / month" },
  { label: "Share cards", free: "Standard", premium: "Full minted note" },
  { label: "Analytics", free: "Not available", premium: "Full assay report" },
  { label: "Ads", free: "House plate", premium: "None" },
];

export default function PremiumClient() {
  const searchParams = useSearchParams();
  const status = normaliseStatus(searchParams.get("status"));
  const [loading, setLoading] = useState(false);
  // Derived refresh key: a successful return re-reads the plan from the server without
  // any state write inside the announcement effect.
  const limits = usePlanLimits(status === "success" ? 1 : 0);
  const viewer = useViewer();
  const reducedMotion = useReducedMotion();
  const announced = useRef<PaymentState | null>(null);

  const isPremium = limits.isPremium || viewer.isPremium;

  useEffect(() => {
    if (announced.current === status) return;
    announced.current = status;
    if (status === "success") {
      toast.success("Premium active. Unlimited mints unlocked.");
      playPremiumUpgradeSound();
    } else if (status === "failed") {
      toast.error("Payment failed. Nothing was charged — try again.");
    } else if (status === "cancelled") {
      toast("Checkout cancelled. Your plan is unchanged.");
    } else if (status === "pending") {
      toast("Payment is still pending with the provider. This page will reflect it once confirmed.");
    }
  }, [status]);

  async function handleUpgrade() {
    if (loading || isPremium) return;
    setLoading(true);
    try {
      const result = await createPremiumOrder();
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      if (!result?.paymentSessionId) {
        toast.error("Couldn't start checkout. Try again.");
        return;
      }
      const cashfreeEnv = process.env.NEXT_PUBLIC_CASHFREE_ENV === "production" ? "production" : "sandbox";
      const { load } = await import("@cashfreepayments/cashfree-js");
      const cashfree = await load({ mode: cashfreeEnv });
      await cashfree.checkout({ paymentSessionId: result.paymentSessionId, redirectTarget: "_self" });
    } catch {
      toast.error("Could not open the payment interface. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <motion.header
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.3 }}
        className="mb-6 text-center"
      >
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-[#C9A227]/40">
          <Crown className="h-6 w-6 text-[#8A6E14] dark:text-[#C9A227]" aria-hidden="true" />
        </span>
        <h1 className="font-display text-3xl leading-none text-foreground">AuraMint+ certificate</h1>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Unlimited minting, the sharpest verdicts, and a share card worth screenshotting.
        </p>
      </motion.header>

      {status === "success" || isPremium ? (
        <Plate className="mb-5 p-6 text-center ring-1 ring-[#C9A227]/40">
          <ShieldCheck className="mx-auto h-8 w-8 text-[#8A6E14] dark:text-[#C9A227]" aria-hidden="true" />
          <h2 className="mt-3 font-display text-2xl text-foreground">Unlimited minting is active</h2>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Your certificate is on file. Manage or cancel from your payment provider at any time — nothing renews
            silently here.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Chip tone="brass">
              <Check className="h-3 w-3" aria-hidden="true" />
              Premium
            </Chip>
            <Link
              href="/profile"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
            >
              View profile
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </Plate>
      ) : (
        <Plate className="mb-5 overflow-hidden">
          <div className="border-b border-border/60 p-6 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Monthly certificate
            </span>
            <div className="mt-2 flex items-baseline justify-center gap-2">
              <span className="font-display text-5xl leading-none text-foreground">₹99</span>
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">/ month</span>
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              or $1.99 for international cards
            </p>
          </div>

          <div className="p-5 sm:p-6">
            <ul className="space-y-2.5">
              {FEATURES.map((feature) => (
                <li key={feature.label} className="flex items-center gap-3 rounded-xl border border-border/60 p-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-secondary/40">
                    <Sparkles className={cn("h-3.5 w-3.5", TONE.brassText)} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground">{feature.label}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1 line-through decoration-[#B4442E]/60">
                        <Minus className="h-3 w-3" aria-hidden="true" />
                        {feature.free}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                        <Check className="h-3 w-3 text-[#16604F] dark:text-[#43B994]" aria-hidden="true" />
                        {feature.premium}
                      </span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <PrimaryButton onClick={handleUpgrade} loading={loading} className="mt-6 w-full" id="upgrade-premium-btn">
              {loading ? "Opening checkout" : "Upgrade to Premium"}
            </PrimaryButton>

            <p className="mt-3 text-center text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Cancel anytime · paid securely via Cashfree
            </p>
          </div>
        </Plate>
      )}

      {/* What the free plan actually gives you today, from the server. */}
      <Plate className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Current plan</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{isPremium ? "Premium" : "Free"}</p>
          </div>
          {isPremium ? (
            <ShieldCheck className="h-7 w-7 text-[#8A6E14] dark:text-[#C9A227]" aria-hidden="true" />
          ) : (
            <Crown className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Events today</span>
          <span className="font-mono text-sm tabular-nums text-foreground">
            {limits.ready
              ? limits.dailyEventsLimit === null
                ? "unlimited"
                : `${limits.dailyEventsUsed}/${limits.dailyEventsLimit}`
              : "—"}
          </span>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
          Prices in INR; taxes may apply. Cancellation is handled by the payment provider.
        </p>
      </Plate>
    </div>
  );
}
