"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import {
  Crown,
  Sparkles,
  Trophy,
  Zap,
  ArrowRight,
  Flame,
  Share2,
  Moon,
  Sun,
  ChevronDown,
  Star,
  Users,
  TrendingUp,
  Check,
  X,
  Diamond,
} from "lucide-react";
import { PremiumIcon } from "@/components/aura/premium-icon";
import { playHapticPop, playAuraGainSound, playAuraLossSound } from "@/lib/utils/sound";
import { createClient } from "@/lib/supabase/client";

/* ─── Static Data ─── */
const sampleEvents = [
  {
    text: "Paid for friend's chai without being asked",
    points: +150,
    emoji: "☕",
    tag: "Bada Dil Wala",
    verdict: "Bada dil wala",
    time: "Just now",
  },
  {
    text: "Left on 'Read' for 4 hrs",
    points: -300,
    emoji: "📱",
    tag: "Social Sin",
    verdict: "Attitude bohot hai",
    time: "2 hrs ago",
  },
  {
    text: "Hit the gym at 6 AM",
    points: +500,
    emoji: "💪",
    tag: "Sigma Grindset",
    verdict: "Sigma Mindset",
    time: "Yesterday",
  },
];

const features = [
  {
    icon: Zap,
    title: "AI Aura Scoring",
    desc: "Our advanced Hinglish-trained AI analyzes your logs to award or deduct Aura Points. Prepare for brutal honesty and dramatic verdicts.",
    iconColor: "text-amber-400",
    iconBg: "bg-amber-400/15",
    hoverBorder: "hover:border-amber-400/40",
    hoverShadow: "hover:shadow-[0_0_25px_rgba(232,163,23,0.15)]",
  },
  {
    icon: Trophy,
    title: "Global Leaderboards",
    desc: "Compete with friends and strangers. Climb the ranks from a 'Peasant' to an 'Aura God' based on your rolling 7-day score.",
    iconColor: "text-violet-400",
    iconBg: "bg-violet-400/15",
    hoverBorder: "hover:border-violet-400/40",
    hoverShadow: "hover:shadow-[0_0_25px_rgba(124,58,237,0.15)]",
  },
  {
    icon: Share2,
    title: "Viral Cards",
    desc: "Generate aesthetic, IG-ready story cards of your most epic wins (or embarrassing losses) to flex your aura journey.",
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-400/15",
    hoverBorder: "hover:border-emerald-400/40",
    hoverShadow: "hover:shadow-[0_0_25px_rgba(16,185,129,0.15)]",
  },
  {
    icon: Flame,
    title: "Streaks & Tiers",
    desc: "Maintain daily logging streaks to unlock point multipliers. Fall off, and watch your hard-earned aura decay into nothingness.",
    iconColor: "text-rose-400",
    iconBg: "bg-rose-400/15",
    hoverBorder: "hover:border-rose-400/40",
    hoverShadow: "hover:shadow-[0_0_25px_rgba(225,29,72,0.15)]",
  },
];

const tiers = [
  { emoji: "🌟", name: "GOD MODE", range: "> 100,000 pts", perk: "Custom Crown Icon", highlight: true },
  { emoji: "🔥", name: "Main Character", range: "50K – 99,999", perk: "Animated Profile", highlight: false },
  { emoji: "😎", name: "Sigma / Chad", range: "25K – 49,999", perk: null, highlight: false },
  { emoji: "✨", name: "Rising Aura", range: "10K – 24,999", perk: null, highlight: false },
  { emoji: "😐", name: "NPC (Default)", range: "0 – 9,999", perk: null, highlight: false },
  { emoji: "📉", name: "Aura Debt", range: "-1 to -5,000", perk: null, highlight: false, negative: true },
  { emoji: "🤡", name: "Clown Behavior", range: "-5K to -20K", perk: null, highlight: false, negative: true },
  { emoji: "💀", name: "Negative Aura", range: "< -20,000", perk: "Public Shaming", highlight: false, negative: true },
];

const stats = [
  { value: "50K+", label: "Events Logged", icon: TrendingUp },
  { value: "12K+", label: "Active Users", icon: Users },
  { value: "4.8★", label: "App Rating", icon: Star },
];

const mockCalculations = [
  { keywords: ["bill", "paid", "everyone", "treat", "money", "dost"], points: 5000, emoji: "👑", tag: "Aura Rich Flex", verdict: "Paisa hi paisa! Absolute main character behaviour. Big flex, but check your bank balance later 💀" },
  { keywords: ["walked out", "left", "group chat", "chat", "bye"], points: 1500, emoji: "🗿", tag: "Sigma Status", verdict: "Pure power move. Left without explaining anything. NPC levels dropped to zero 🤫" },
  { keywords: ["sunglasses", "inside", "indoors"], points: -1200, emoji: "💀", tag: "Extreme Cringe Arc", verdict: "Bro thinks he's in a sci-fi film. Squinting inside is a massive NPC L. Take them off 🕶️" },
  { keywords: ["voice", "cracked", "presentation", "public"], points: -3500, emoji: "😬", tag: "Public Execution", verdict: "Arre yaar... sabke saamne? Voice crack is character building, but currently you're an NPC 💀" },
  { keywords: ["gym", "lift", "workout", "dumbbell", "exercise"], points: 2500, emoji: "💪", tag: "Gym Arc Active", verdict: "Main character gains. Consistent efforts fr fr. The gods are impressed 🔱" },
];

const getCustomRating = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = input.charCodeAt(i) + ((hash << 5) - hash);
  const isPositive = hash % 2 === 0;
  const points = isPositive ? (Math.abs(hash) % 4000) + 500 : -((Math.abs(hash) % 4000) + 500);
  const positiveVerdicts = ["Vibe match successfully detected. High-level energy fr. Main character energy fr 👑", "Sigma aura levels rising. The crowd stands up. W decision ⚡", "God mode parameters unlocked. Extremely iconic energy. Flex it! 🌟", "Crushing it king/queen. Respect successfully generated 🗿"];
  const negativeVerdicts = ["Ouch... that was painful. NPC traits found. Aura points have departed the chat 💀", "Absolute L. Sab log dekh rahe hain bro. Therapy arc starts now 😬", "Main character license revoked. Try holding the door next time 😐", "Cringe detected. Vibe check has returned zero results 💀"];
  const verdicts = isPositive ? positiveVerdicts : negativeVerdicts;
  const verdict = verdicts[Math.abs(hash) % verdicts.length];
  const tags = isPositive ? ["Iconic Energy", "W Move", "Peak Behavior", "Alpha Flex"] : ["NPC Arc", "Glitch in Vibe", "Cringe Alert", "Down Bad"];
  const tag = tags[Math.abs(hash) % tags.length];
  const emojis = isPositive ? ["👑", "⚡", "🌟", "🔥", "💪"] : ["💀", "🗿", "😐", "😬"];
  const emoji = emojis[Math.abs(hash) % emojis.length];
  return { points, emoji, verdict, tag };
};

/* ─── Page Component ─── */
export default function LandingPage() {
  const { theme, setTheme } = useTheme();
  const [demoInput, setDemoInput] = useState("");
  const [demoStatus, setDemoStatus] = useState<"idle" | "loading" | "success">("idle");
  const [demoLoadingText, setDemoLoadingText] = useState("Analyzing vibe checks...");
  const [demoResult, setDemoResult] = useState<{ points: number; emoji: string; verdict: string; tag: string } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setIsLoggedIn(true);
    });
  }, []);

  async function handleDemoCalculate() {
    if (!demoInput.trim()) return;
    playHapticPop();
    setDemoStatus("loading");
    setDemoLoadingText("Analyzing vibe checks...");
    const loaders = ["Consulting standard vibe models...", "Calculating absolute main character thresholds...", "Analyzing potential cringe outputs...", "Generating savage verdict summary..."];
    for (let i = 0; i < loaders.length; i++) {
      await new Promise((r) => setTimeout(r, 600));
      setDemoLoadingText(loaders[i]);
    }
    const lowerInput = demoInput.toLowerCase();
    const match = mockCalculations.find((mc) => mc.keywords.some((kw) => lowerInput.includes(kw)));
    const resultData = match ? { points: match.points, emoji: match.emoji, verdict: match.verdict, tag: match.tag } : getCustomRating(demoInput);
    setDemoResult(resultData);
    if (resultData.points >= 0) playAuraGainSound();
    else playAuraLossSound();
    setDemoStatus("success");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent selection:bg-primary/25 selection:text-primary">
      {/* ═══ COSMIC BACKGROUND LAYER ═══ */}
      <div className="pointer-events-none fixed inset-0 z-0">
        {/* Cosmic gradient mesh */}
        <div className="absolute inset-0 cosmic-mesh animate-breathe opacity-80" />
        {/* Dot grid overlay */}
        <div className="absolute inset-0 dot-grid opacity-40" />
        {/* Glowing orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-primary/15 blur-[100px] animate-breathe" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-accent/15 blur-[120px] animate-breathe" style={{ animationDelay: "2s" }} />
        <div className="absolute top-2/3 left-1/2 w-48 h-48 rounded-full bg-emerald-500/10 blur-[80px] animate-breathe" style={{ animationDelay: "4s" }} />
        {/* Twinkling stars */}
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="star absolute rounded-full bg-foreground/20"
            style={{
              width: `${1 + Math.random() * 2}px`,
              height: `${1 + Math.random() * 2}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              ["--dur" as string]: `${3 + Math.random() * 4}s`,
              ["--del" as string]: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* ═══ FIXED NAVBAR ═══ */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur-md border-b border-border/40 bg-background/80 shadow-[0_0_20px_rgba(232,163,23,0.06)]">
        <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/15">
              <Crown className="h-[18px] w-[18px] text-primary" />
            </div>
            <span className="heading text-xl tracking-tighter grad-gold">AuraMint</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#tiers" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">Tiers</a>
            <a href="#pricing" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">Premium</a>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex items-center justify-center w-10 h-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {isLoggedIn ? (
              <Link href="/dashboard" className="bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-xl glow-brand hover:brightness-110 transition-all active:scale-95 text-xs uppercase tracking-wide">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden sm:block text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider">
                  Login
                </Link>
                <Link href="/signup" className="bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-xl glow-brand hover:brightness-110 transition-all active:scale-95 text-xs uppercase tracking-wide">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ═══ HERO SECTION ═══ */}
      <section className="relative z-10 min-h-[90vh] flex flex-col items-center justify-center text-center px-4 pt-24 overflow-hidden">
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          {/* Pill badge */}
          <div className="glass-card rounded-full px-5 py-2.5 flex items-center gap-2 mb-8 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">India&apos;s First AI Aura Tracker</span>
          </div>

          {/* Massive headline */}
          <h1 className="heading-fluid-hero animate-fade-up" style={{ animationDelay: "0.2s" }}>
            Every moment has an <br className="hidden md:block" />
            <span className="grad-gold">AURA</span>
            <span className="text-muted-foreground/40"> — do you know yours?</span>
          </h1>

          {/* Subtext */}
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mt-8 mb-10 leading-relaxed animate-fade-up" style={{ animationDelay: "0.3s" }}>
            Track your daily life with AI-powered scoring, dramatic Hinglish verdicts, and social leaderboards. Let the cosmos judge your vibe.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto animate-fade-up" style={{ animationDelay: "0.4s" }}>
            <Link
              href={isLoggedIn ? "/dashboard" : "/signup"}
              className="bg-primary text-primary-foreground font-bold px-8 py-4 rounded-xl glow-brand hover:brightness-110 hover:-translate-y-1 transition-all active:scale-95 uppercase tracking-wide text-sm flex items-center justify-center gap-2"
            >
              {isLoggedIn ? "Go to Dashboard" : "Start Free \u2014 No Credit Card"}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="glass-card text-foreground font-bold px-7 py-4 rounded-xl hover:bg-muted/60 dark:hover:bg-white/10 transition-all hover:-translate-y-1 active:scale-95 uppercase tracking-wide text-sm flex items-center justify-center gap-2 border border-border/40"
            >
              See How It Works
              <ChevronDown className="h-4 w-4" />
            </a>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap justify-center gap-10 mt-16 pt-8 border-t border-border/30 w-full max-w-2xl animate-fade-up" style={{ animationDelay: "0.5s" }}>
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col items-center">
                <span className="mono text-2xl font-bold text-foreground">{s.value}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ INTERACTIVE DEMO ═══ */}
      <section className="relative z-10 py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="heading text-3xl md:text-4xl tracking-tight mb-4">Test Your Aura</h2>
            <p className="text-muted-foreground">Enter a life event and let our AI judge you.</p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 items-center justify-center">
            {/* Demo card — Terminal style */}
            <div className="glass-card rounded-2xl p-8 w-full max-w-md relative overflow-hidden group hover:shadow-[0_0_30px_rgba(255,255,255,0.05)] transition-all duration-500">
              <div className="grain-overlay" />
              {/* Terminal dots */}
              <div className="flex items-center gap-2 mb-6 relative z-10">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-2 mono text-[10px] text-muted-foreground">Live AI Aura Calculator Demo</span>
              </div>

              <div className="space-y-4 relative z-10">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">What did you do?</label>
                  <textarea
                    value={demoInput}
                    onChange={(e) => setDemoInput(e.target.value)}
                    placeholder="Left my group chat without saying bye..."
                    className="w-full aura-input rounded-xl p-4 text-sm resize-none h-24"
                  />
                </div>
                <button
                  onClick={handleDemoCalculate}
                  className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl glow-brand hover:brightness-110 hover:scale-[1.02] transition-all active:scale-95 uppercase tracking-wide text-sm flex items-center justify-center gap-2"
                >
                  Rate It <Zap className="h-4 w-4" />
                </button>
              </div>

              {/* Result area */}
              <AnimatePresence mode="wait">
                {demoStatus === "loading" && (
                  <motion.div
                    key="loader"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-6 pt-6 border-t border-border/30 text-center flex flex-col items-center gap-3 relative z-10"
                  >
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                    <p className="text-xs font-bold text-muted-foreground animate-pulse">{demoLoadingText}</p>
                  </motion.div>
                )}
                {demoStatus === "success" && demoResult && (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-6 pt-6 border-t border-border/30 relative z-10"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded uppercase tracking-wider ${demoResult.points > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                        {demoResult.tag}
                      </span>
                      <span className={`mono text-2xl font-bold ${demoResult.points > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {demoResult.points > 0 ? "+" : ""}{demoResult.points.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-foreground italic text-base mt-3">&ldquo;{demoResult.verdict}&rdquo;</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-2">Aura {demoResult.points > 0 ? "heavily boosted" : "heavily damaged"}.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Floating sample cards */}
            <div className="relative w-full max-w-md h-[420px] hidden lg:block">
              {sampleEvents.map((ev, i) => {
                const positions = [
                  "top-0 right-0 rotate-6",
                  "top-28 left-0 -rotate-3",
                  "bottom-0 right-10 rotate-2",
                ];
                const animations = ["animate-float", "animate-float-delayed", "animate-float-slow"];
                return (
                  <div
                    key={i}
                    className={`absolute ${positions[i]} glass-card rounded-xl p-5 w-72 ${animations[i]} hover:rotate-0 hover:z-20 transition-all duration-300 shadow-xl cursor-default`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl">{ev.emoji}</span>
                      <div>
                        <p className="text-[11px] text-muted-foreground">{ev.time}</p>
                        <p className="font-bold text-sm text-foreground">{ev.text}</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center bg-muted/40 dark:bg-black/30 rounded-lg p-3">
                      <span className={`mono font-bold text-sm ${ev.points > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {ev.points > 0 ? "+" : ""}{ev.points} Aura
                      </span>
                      <span className="text-[10px] italic text-muted-foreground">&ldquo;{ev.verdict}&rdquo;</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FEATURES GRID ═══ */}
      <section id="features" className="relative z-10 py-24 border-y border-border/20 bg-muted/20 dark:bg-black/20">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="heading text-3xl md:text-5xl tracking-tight mb-4">Core Mechanics</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">More than just a journal. It&apos;s a game of life where every action has cosmic consequences.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                viewport={{ once: true }}
                className={`glass-card rounded-xl p-8 ${f.hoverBorder} ${f.hoverShadow} hover:-translate-y-1 transition-all duration-300 group`}
              >
                <div className={`w-14 h-14 rounded-2xl ${f.iconBg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <f.icon className={`h-6 w-6 ${f.iconColor}`} />
                </div>
                <h3 className="heading text-lg tracking-tight mb-3 group-hover:text-primary transition-colors">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TIER TABLE ═══ */}
      <section id="tiers" className="relative z-10 py-24 px-4 max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="heading text-3xl md:text-5xl tracking-tight mb-4">The Aura Hierarchy</h2>
          <p className="text-muted-foreground">Where do you stand in the cosmic order?</p>
        </div>

        <div className="glass-card rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_1fr_auto] gap-4 p-6 border-b border-border/30 bg-muted/20 dark:bg-white/5">
            <div className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest">Tier / Status</div>
            <div className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest hidden md:block">Requirement</div>
            <div className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest text-right">Perks</div>
          </div>
          {/* Rows */}
          <div className="divide-y divide-border/20">
            {tiers.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                viewport={{ once: true }}
                className={`grid grid-cols-[1fr_auto] md:grid-cols-[1fr_1fr_auto] gap-4 p-5 md:p-6 items-center hover:bg-muted/30 dark:hover:bg-white/5 transition-colors ${t.negative ? "bg-red-500/[0.03]" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl hover:scale-110 transition-transform">{t.emoji}</span>
                  <span className={`font-bold uppercase text-sm ${t.highlight ? "grad-gold" : t.negative ? "text-red-400" : "text-foreground"}`} style={t.highlight ? { textShadow: "0 0 10px rgba(232,163,23,0.5)" } : {}}>
                    {t.name}
                  </span>
                </div>
                <div className={`mono text-xs hidden md:block ${t.negative ? "text-red-400" : "text-muted-foreground"}`}>{t.range}</div>
                <div className="text-right">
                  {t.perk ? (
                    <span className={`glass-card px-3 py-1 rounded text-[10px] font-bold ${t.highlight ? "text-primary border-primary/30" : t.negative ? "text-red-400 border-red-400/30" : "text-foreground"}`}>
                      {t.perk}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/30">—</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pricing" className="relative z-10 py-24 overflow-hidden">
        {/* BG Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-96 bg-accent/10 rounded-full blur-[120px] z-[-1] animate-breathe" />

        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-accent font-bold tracking-widest uppercase text-xs mb-2 block">Monetize Your Vibe</span>
            <h2 className="heading text-3xl md:text-5xl tracking-tight mb-4">Upgrade to Premium</h2>
          </div>

          <div className="flex flex-col md:flex-row gap-8 justify-center">
            {/* Free Tier */}
            <div className="glass-card rounded-2xl p-8 w-full max-w-sm flex flex-col border border-border/30 hover:border-primary/20 transition-all duration-300">
              <div className="mb-8">
                <h3 className="heading text-xl mb-2">Free NPC</h3>
                <p className="text-muted-foreground text-xs">Basic aura tracking for casuals.</p>
                <div className="mt-6 mono text-4xl font-bold">₹0<span className="text-sm text-muted-foreground">/mo</span></div>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                {["3 AI logs per day", "Basic leaderboards", "Standard viral cards", "Default theme"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm"><Check className="h-4 w-4 text-foreground" />{item}</li>
                ))}
                {["Event Boosts", "Detailed Analytics", "Custom Badges", "Premium Cards", "Ad-free", "Early Access"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-muted-foreground/50"><X className="h-4 w-4" />{item}</li>
                ))}
              </ul>
              <Link href="/signup" className="w-full glass-card text-center py-3.5 rounded-xl font-bold uppercase tracking-wide text-sm hover:bg-muted/50 dark:hover:bg-white/10 transition-all border border-border/40">
                Get Started Free
              </Link>
            </div>

            {/* Premium Tier */}
            <div className="glass-card rounded-2xl p-8 w-full max-w-sm flex flex-col border border-primary/30 shadow-[0_0_30px_rgba(232,163,23,0.1)] hover:shadow-[0_0_40px_rgba(232,163,23,0.2)] transition-all duration-300 relative overflow-hidden">
              <div className="grain-overlay" />
              {/* Popular badge */}
              <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-primary/20 border border-primary/30 rounded-full px-3 py-1 z-10">
                <Diamond className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Popular</span>
              </div>
              <div className="mb-8 relative z-10">
                <h3 className="heading text-xl mb-2 grad-gold">Premium God</h3>
                <p className="text-muted-foreground text-xs">Unlimited power. Maximum aura.</p>
                <div className="mt-6 mono text-4xl font-bold">₹99<span className="text-sm text-muted-foreground">/mo</span></div>
              </div>
              <ul className="space-y-3 mb-8 flex-grow relative z-10">
                {["Unlimited AI logs", "5 Boosts/month 🚀", "Priority leaderboards", "Premium holographic cards", "Detailed analytics dashboard", "All custom badges", "6 exclusive themes", "Ad-free experience", "Early feature access"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm"><Check className="h-4 w-4 text-primary" />{item}</li>
                ))}
              </ul>
              <Link href="/signup" className="w-full bg-primary text-primary-foreground text-center py-3.5 rounded-xl font-bold uppercase tracking-wide text-sm glow-brand hover:brightness-110 transition-all active:scale-95 relative z-10">
                Upgrade Now
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="relative z-10 py-28 text-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-breathe" />
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="relative z-10 flex flex-col items-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 border border-primary/15 shadow-xl aura-orb">
            <Crown className="h-8 w-8 text-primary" />
          </div>
          <h2 className="heading text-3xl sm:text-5xl tracking-tight leading-tight">
            Ready to discover <br />
            your <span className="grad-gold">aura</span>?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            Join thousands of Gen-Z users flexing their aura scores. Free forever. No ads on feed.
          </p>
          <Link
            href={isLoggedIn ? "/dashboard" : "/signup"}
            className="mt-8 flex items-center gap-2.5 rounded-xl bg-primary px-10 py-5 text-sm font-extrabold uppercase tracking-wider text-primary-foreground transition hover:scale-[1.03] hover:brightness-110 glow-brand"
          >
            <Sparkles className="h-4 w-4" />
            {isLoggedIn ? "Go to Dashboard" : "Start Your Aura Journey"}
          </Link>
        </motion.div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="relative z-10 border-t border-border/30 py-12 text-center bg-muted/20 dark:bg-black/30">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
          <Crown className="h-5 w-5 text-primary" />
          <span className="heading text-base tracking-tight grad-gold">AuraMint</span>
        </Link>
        <p className="text-xs text-muted-foreground">
          Built with 💛 by{" "}
          <a href="https://novamintnetworks.in" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
            NovaMint Networks
          </a>
        </p>
        <p className="mt-2 text-[10px] uppercase font-bold tracking-wider text-muted-foreground/40">
          © {new Date().getFullYear()} AuraMint. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
