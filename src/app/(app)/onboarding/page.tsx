"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Sparkles, ArrowRight, Zap, Users, Flame } from "lucide-react";
import { updateUsername } from "@/lib/actions/aura-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { PremiumIcon } from "@/components/aura/premium-icon";

const steps = [
  {
    title: "Welcome to AuraMint",
    subtitle: "Your aura journey starts here. Let's set you up.",
    emoji: "✨",
  },
  {
    title: "Pick Your Username",
    subtitle: "This is how others will find you. Make it iconic.",
    emoji: "🎭",
  },
  {
    title: "How It Works",
    subtitle: "Log moments → AI rates your aura → Climb the ranks",
    emoji: "⚡",
  },
];

const features = [
  { icon: Zap, label: "Log aura events", desc: "Describe what happened and AI rates your aura impact" },
  { icon: Users, label: "Community feed", desc: "See what's happening in the aura universe" },
  { icon: Flame, label: "Streaks & tiers", desc: "Keep your streak alive and climb from NPC to GOD MODE" },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleUsernameSubmit() {
    if (username.length < 3) {
      toast.error("Username must be at least 3 characters");
      return;
    }
    setLoading(true);
    const result = await updateUsername(username);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Username set successfully! Let's go 🚀");
    setStep(2);
  }

  function handleFinish() {
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden bg-background px-4 py-8">
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/[0.04] blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/[0.04] blur-[120px]" />
      </div>

      {/* Header Branding */}
      <div className="relative z-10 pt-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 border border-primary/5 shadow-sm">
            <Crown className="h-[20px] w-[20px] text-primary" />
          </div>
          <span className="heading text-2xl tracking-tighter grad-text">AuraMint</span>
        </div>
      </div>

      {/* Main Container Card block */}
      <div className="relative z-10 w-full max-w-md my-auto pt-6">
        {/* Progress bar dots indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 rounded-full transition-all duration-500 border border-border/10",
                i === step ? "w-8 bg-primary" : i < step ? "w-2 bg-primary/40" : "w-2 bg-muted/60"
              )}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 0: Welcome Frame */}
          {step === 0 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="glass noise relative overflow-hidden p-8 text-center border border-border/30 rounded-[2rem] shadow-2xl"
            >
              <div className="relative z-10">
                <div className="mx-auto mb-6 flex h-22 w-22 items-center justify-center rounded-3xl bg-primary/15 border border-primary/20 shadow-lg aura-orb select-none">
                  <PremiumIcon emoji="👑" className="h-12 w-12" />
                </div>
                <h1 className="heading text-2xl tracking-tight leading-none">{steps[0].title}</h1>
                <p className="mt-2.5 text-xs sm:text-sm text-muted-foreground leading-relaxed px-4">{steps[0].subtitle}</p>

                <button
                  onClick={() => setStep(1)}
                  className="mt-8 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-primary py-4 text-xs font-extrabold uppercase tracking-wider text-primary-foreground transition hover:brightness-110 shadow-lg glow-brand"
                >
                  <span>Let&apos;s Get Started</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 1: Claim Username Screen */}
          {step === 1 && (
            <motion.div
              key="username"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="glass noise relative overflow-hidden p-8 border border-border/30 rounded-[2rem] shadow-2xl"
            >
              <div className="relative z-10">
                <div className="mx-auto mb-6 flex h-22 w-22 items-center justify-center rounded-3xl bg-primary/15 border border-primary/20 shadow-lg aura-orb select-none">
                  <PremiumIcon emoji="🎭" className="h-12 w-12" />
                </div>
                <h2 className="heading text-2xl tracking-tight text-center leading-none">{steps[1].title}</h2>
                <p className="mt-2 text-center text-xs sm:text-sm text-muted-foreground leading-relaxed px-2">{steps[1].subtitle}</p>

                <div className="mt-6">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground/60">@</span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20))}
                      placeholder="your_unique_tag"
                      className="w-full rounded-2xl border border-border/80 bg-secondary/15 py-4 pl-8 pr-4 text-xs font-semibold tracking-wide transition placeholder:text-muted-foreground/45 focus:border-primary/50 focus:bg-secondary/35 focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <p className="mt-2 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest leading-normal pl-1">
                    3-20 characters, lowercase letters, numbers, and underscores only
                  </p>
                </div>

                <button
                  onClick={handleUsernameSubmit}
                  disabled={loading || username.length < 3}
                  className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-primary py-4.5 text-xs font-extrabold uppercase tracking-wider text-primary-foreground transition hover:brightness-110 shadow-lg glow-brand disabled:opacity-50"
                >
                  {loading ? (
                    <div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-primary-foreground/20 border-t-primary-foreground" />
                  ) : (
                    <>
                      <span>Claim Username</span>
                      <Sparkles className="h-4 w-4" />
                    </>
                  )}
                </button>

                <button
                  onClick={() => setStep(2)}
                  className="mt-4 w-full text-center text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60 hover:text-foreground transition"
                >
                  Skip for now
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2: How It Works Tutorial */}
          {step === 2 && (
            <motion.div
              key="howto"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="glass noise relative overflow-hidden p-8 border border-border/30 rounded-[2rem] shadow-2xl"
            >
              <div className="relative z-10">
                <div className="mx-auto mb-6 flex h-22 w-22 items-center justify-center rounded-3xl bg-primary/15 border border-primary/20 shadow-lg aura-orb select-none">
                  <PremiumIcon emoji="⚡" className="h-12 w-12" />
                </div>
                <h2 className="heading text-2xl tracking-tight text-center leading-none">{steps[2].title}</h2>
                <p className="mt-2 text-center text-xs sm:text-sm text-muted-foreground leading-relaxed px-2">{steps[2].subtitle}</p>

                <div className="mt-6 space-y-3.5">
                  {features.map((f, i) => (
                    <motion.div
                      key={f.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + i * 0.1 }}
                      className="flex items-start gap-4 rounded-2xl bg-secondary/20 border border-border/10 p-3.5"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/5 text-primary">
                        <f.icon className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold leading-tight text-foreground">{f.label}</p>
                        <p className="text-[10px] leading-relaxed text-muted-foreground/80 mt-1">{f.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <button
                  onClick={handleFinish}
                  className="mt-8 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-primary py-4.5 text-xs font-extrabold uppercase tracking-wider text-primary-foreground transition hover:brightness-110 shadow-lg glow-brand"
                >
                  <span>Start Minting Aura</span>
                  <Crown className="h-4 w-4 animate-bounce" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Branding Copyright */}
      <div className="relative z-10 text-center">
        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/35">
          © {new Date().getFullYear()} AuraMint. All rights reserved.
        </p>
      </div>
    </div>
  );
}
