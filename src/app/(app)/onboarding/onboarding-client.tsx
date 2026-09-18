"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, ArrowRight, Zap, Users, Flame, Crown, AtSign, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { updateUsername } from "@/lib/actions/aura-actions";
import { createClient } from "@/lib/supabase/client";
import { Plate, PrimaryButton } from "@/components/aura/primitives";
import { playHapticPop } from "@/lib/utils/sound";

const STEPS = [
  { title: "Welcome to AuraMint", subtitle: "Your aura journey starts here. Three quick steps.", icon: Crown },
  { title: "Claim your handle", subtitle: "This is how the ledger will list you. Make it iconic.", icon: AtSign },
  { title: "How minting works", subtitle: "Log a moment → the assayer rates it → climb the ranks.", icon: Zap },
];

const FEATURES = [
  { icon: Zap, label: "Log aura events", desc: "Describe what happened; the assayer returns points, a verdict and a vibe." },
  { icon: Users, label: "The ledger", desc: "See what everyone else is minting, and vote W or L." },
  { icon: Flame, label: "Streaks & tiers", desc: "Keep the streak alive and climb from NPC to GOD MODE." },
];

type Availability = "idle" | "checking" | "available" | "taken" | "error";

export default function OnboardingClient() {
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState("");
  const [check, setCheck] = useState<{ forName: string; result: "available" | "taken" | "error" } | null>(null);
  const [claiming, setClaiming] = useState(false);
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const mounted = useRef(true);

  const cleanName = username.trim().toLowerCase();
  // Derived availability: a short name is simply "idle", and a name we have not checked
  // yet is "checking" — no synchronous state writes in the effect.
  const availability: Availability =
    cleanName.length < 3 ? "idle" : check?.forName === cleanName ? check.result : "checking";

  useEffect(() => {
    mounted.current = true;
    async function fetchProfile() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("profiles").select("username").eq("id", user.id).single();
        const existing = (data as { username?: string | null } | null)?.username;
        if (existing && !existing.startsWith("user_") && mounted.current) setUsername(existing);
      } catch {
        /* onboarding still works without a prefill */
      }
    }
    void fetchProfile();
    return () => {
      mounted.current = false;
    };
  }, []);

  // Debounced availability check (the PRD promises a real-time availability signal).
  useEffect(() => {
    if (cleanName.length < 3) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.from("profiles").select("id").eq("username", cleanName).maybeSingle();
        if (cancelled) return;
        setCheck({ forName: cleanName, result: error ? "error" : data ? "taken" : "available" });
      } catch {
        if (!cancelled) setCheck({ forName: cleanName, result: "error" });
      }
    }, 420);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cleanName]);

  async function handleUsernameSubmit() {
    const clean = username.trim().toLowerCase();
    if (claiming) return;
    if (clean.length < 3) {
      toast.error("Usernames need at least 3 characters.");
      return;
    }
    if (availability === "taken") {
      toast.error("That handle is already in the ledger. Pick another.");
      return;
    }
    setClaiming(true);
    try {
      const result = (await updateUsername(clean)) as { error?: string; success?: boolean };
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Handle claimed. Welcome to the ledger.");
      setStep(2);
    } catch {
      toast.error("Couldn't claim that handle. Check your connection and retry.");
    } finally {
      setClaiming(false);
    }
  }

  function handleFinish() {
    router.push("/dashboard");
    router.refresh();
  }

  const availabilityNote: Record<Availability, { text: string; className: string } | null> = {
    idle: null,
    checking: { text: "Checking the ledger…", className: "text-muted-foreground" },
    available: { text: "Available", className: "text-[#16604F] dark:text-[#43B994]" },
    taken: { text: "Already taken", className: "text-[#9E3A26] dark:text-[#E0795F]" },
    error: { text: "Couldn't check availability — you can still try", className: "text-muted-foreground" },
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-between px-4 py-8">
      <header className="pt-4">
        <Link href="/dashboard" className="flex items-center gap-3 transition-opacity hover:opacity-90">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#C9A227]/40">
            <Crown className="h-5 w-5 text-[#8A6E14] dark:text-[#C9A227]" aria-hidden="true" />
          </span>
          <span className="font-display text-2xl tracking-tight text-foreground">AuraMint</span>
        </Link>
      </header>

      <div className="my-auto w-full max-w-md pt-6">
        {/* Progress */}
        <div className="mb-7 flex items-center justify-center gap-2" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === step ? "w-8 bg-[#1F6F5C]" : i < step ? "w-2 bg-[#1F6F5C]/40" : "w-2 bg-muted"
              )}
            />
          ))}
        </div>

        {step === 0 ? (
          <Plate className="p-7 text-center">
            <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-[#C9A227]/40">
              <Crown className="h-8 w-8 text-[#8A6E14] dark:text-[#C9A227]" aria-hidden="true" />
            </span>
            <h1 className="font-display text-2xl leading-tight text-foreground">{STEPS[0].title}</h1>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{STEPS[0].subtitle}</p>
            <PrimaryButton className="mt-7 w-full" onClick={() => setStep(1)}>
              Get started
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </PrimaryButton>
          </Plate>
        ) : null}

        {step === 1 ? (
          <Plate className="p-7">
            <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-border">
              <AtSign className="h-7 w-7 text-foreground" aria-hidden="true" />
            </span>
            <h2 className="text-center font-display text-2xl leading-tight text-foreground">{STEPS[1].title}</h2>
            <p className="mx-auto mt-2 max-w-xs text-center text-sm leading-relaxed text-muted-foreground">
              {STEPS[1].subtitle}
            </p>

            <div className="mt-6">
              <label htmlFor="onboarding-username" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
                <input
                  id="onboarding-username"
                  type="text"
                  value={username}
                  autoComplete="username"
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
                  placeholder="your_unique_handle"
                  aria-describedby="onboarding-username-help"
                  className="w-full rounded-xl border border-border bg-secondary/20 py-3.5 pl-8 pr-10 text-sm text-foreground transition placeholder:text-muted-foreground/60 focus:border-[#1F6F5C]/60 focus:outline-none"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2" aria-hidden="true">
                  {availability === "checking" ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                  {availability === "available" ? <Check className="h-4 w-4 text-[#16604F] dark:text-[#43B994]" /> : null}
                  {availability === "taken" ? <X className="h-4 w-4 text-[#9E3A26] dark:text-[#E0795F]" /> : null}
                </span>
              </div>
              <p id="onboarding-username-help" className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                3–20 characters: lowercase letters, numbers and underscores.
                {availabilityNote[availability] ? (
                  <>
                    {" "}
                    <span className={availabilityNote[availability]?.className}>{availabilityNote[availability]?.text}</span>
                  </>
                ) : null}
              </p>
            </div>

            <PrimaryButton
              className="mt-5 w-full"
              onClick={handleUsernameSubmit}
              loading={claiming}
              disabled={username.trim().length < 3 || availability === "checking" || availability === "taken"}
            >
              Claim handle
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </PrimaryButton>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="mt-3 w-full text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
            >
              Skip for now
            </button>
          </Plate>
        ) : null}

        {step === 2 ? (
          <Plate className="p-7">
            <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-border">
              <Zap className="h-7 w-7 text-[#8A6E14] dark:text-[#C9A227]" aria-hidden="true" />
            </span>
            <h2 className="text-center font-display text-2xl leading-tight text-foreground">{STEPS[2].title}</h2>
            <p className="mx-auto mt-2 max-w-xs text-center text-sm leading-relaxed text-muted-foreground">
              {STEPS[2].subtitle}
            </p>

            <div className="mt-6 space-y-3">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.label}
                  initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reducedMotion ? { duration: 0 } : { duration: 0.26, delay: Math.min(i, 3) * 0.06 }}
                  className="flex items-start gap-3.5 rounded-xl border border-border/60 p-3.5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-secondary/40 text-foreground">
                    <f.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{f.label}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <PrimaryButton
              className="mt-7 w-full"
              onClick={() => {
                playHapticPop();
                handleFinish();
              }}
            >
              Start minting aura
              <Crown className="h-4 w-4" aria-hidden="true" />
            </PrimaryButton>
          </Plate>
        ) : null}
      </div>

      <footer className="pb-2 text-center">
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
          AuraMint · minted by NovaMint Networks
        </p>
      </footer>
    </div>
  );
}
