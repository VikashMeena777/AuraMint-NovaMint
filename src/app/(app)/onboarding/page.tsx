"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Sparkles, ArrowRight, Zap, Users, Flame } from "lucide-react";
import { updateUsername } from "@/lib/actions/aura-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const steps = [
  {
    title: "Welcome to AuraMint 👑",
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
    toast.success("Username set! Let's go 🚀");
    setStep(2);
  }

  function handleFinish() {
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Background */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/10 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Progress dots */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === step ? "w-8 bg-primary" : i < step ? "w-2 bg-primary/40" : "w-2 bg-muted"
              )}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass noise relative overflow-hidden p-7 text-center"
            >
              <div className="relative z-10">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-4xl aura-orb">
                  👑
                </div>
                <h1 className="heading text-2xl">{steps[0].title}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{steps[0].subtitle}</p>

                <button
                  onClick={() => setStep(1)}
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground transition hover:brightness-110 glow-brand"
                >
                  Let&apos;s Go
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 1: Username */}
          {step === 1 && (
            <motion.div
              key="username"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass noise relative overflow-hidden p-7"
            >
              <div className="relative z-10">
                <div className="mb-5 text-center text-4xl">🎭</div>
                <h2 className="heading text-xl text-center">{steps[1].title}</h2>
                <p className="mt-1 text-center text-sm text-muted-foreground">{steps[1].subtitle}</p>

                <div className="mt-6">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20))}
                      placeholder="your_username"
                      className="w-full rounded-xl border border-border bg-secondary/20 py-3 pl-8 pr-4 text-sm transition placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    3-20 characters, letters, numbers, underscores only
                  </p>
                </div>

                <button
                  onClick={handleUsernameSubmit}
                  disabled={loading || username.length < 3}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/20 border-t-primary-foreground" />
                  ) : (
                    <>
                      Claim Username
                      <Sparkles className="h-4 w-4" />
                    </>
                  )}
                </button>

                <button
                  onClick={() => setStep(2)}
                  className="mt-3 w-full text-center text-[12px] text-muted-foreground hover:text-foreground transition"
                >
                  Skip for now
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2: How It Works */}
          {step === 2 && (
            <motion.div
              key="howto"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass noise relative overflow-hidden p-7"
            >
              <div className="relative z-10">
                <div className="mb-5 text-center text-4xl">⚡</div>
                <h2 className="heading text-xl text-center">{steps[2].title}</h2>
                <p className="mt-1 text-center text-sm text-muted-foreground">{steps[2].subtitle}</p>

                <div className="mt-6 space-y-3">
                  {features.map((f, i) => (
                    <motion.div
                      key={f.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.1 }}
                      className="flex items-start gap-3 rounded-xl bg-secondary/30 p-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <f.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold">{f.label}</p>
                        <p className="text-[11px] text-muted-foreground">{f.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <button
                  onClick={handleFinish}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground transition hover:brightness-110 glow-brand"
                >
                  Start Minting Aura
                  <Crown className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
