"use client";

import { useState } from "react";
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
  ChevronRight,
  Star,
  Users,
  TrendingUp,
} from "lucide-react";
import { PremiumIcon } from "@/components/aura/premium-icon";
import { playHapticPop, playAuraGainSound, playAuraLossSound } from "@/lib/utils/sound";

const sampleEvents = [
  {
    text: "Held the door for crush and she said thanks",
    points: +800,
    emoji: "✨",
    tag: "Main Character Energy",
    verdict: "She said thanks. Not your name. But baby steps king. 👑",
  },
  {
    text: "Voice cracked during college presentation",
    points: -3200,
    emoji: "💀",
    tag: "Therapy Arc Needed",
    verdict: "Arre yaar... sabke saamne? Public execution tha ye toh 😬",
  },
  {
    text: "Got the last samosa at the canteen",
    points: +1400,
    emoji: "🔥",
    tag: "Sigma Grindset",
    verdict: "The samosa chose YOU. Destiny ka khel, not luck. Based. 🔥",
  },
];

const features = [
  {
    icon: Zap,
    title: "AI Aura Scoring",
    desc: "NIM-powered AI rates your moments with dramatic Hinglish verdicts + points",
    color: "from-amber-500/10 to-orange-500/5",
    borderColor: "hover:border-amber-500/30",
  },
  {
    icon: Trophy,
    title: "Leaderboards",
    desc: "Climb from NPC to GOD MODE. Daily, weekly, and all-time rankings",
    color: "from-violet-500/10 to-purple-500/5",
    borderColor: "hover:border-violet-500/30",
  },
  {
    icon: Share2,
    title: "Viral Cards",
    desc: "Every verdict becomes a share-ready card for TikTok, Reels & WhatsApp",
    color: "from-emerald-500/10 to-teal-500/5",
    borderColor: "hover:border-emerald-500/30",
  },
  {
    icon: Flame,
    title: "Streaks & Tiers",
    desc: "Daily streaks, bonus aura, 7 progression tiers, and collectible badges",
    color: "from-rose-500/10 to-red-500/5",
    borderColor: "hover:border-rose-500/30",
  },
];

const tiers = [
  { emoji: "💀", name: "Negative Aura", range: "< 0", bg: "hover:bg-red-500/5 hover:border-red-500/30" },
  { emoji: "🗿", name: "NPC", range: "0 – 5K", bg: "hover:bg-slate-500/5 hover:border-slate-500/30" },
  { emoji: "😐", name: "Civilian", range: "5K – 25K", bg: "hover:bg-violet-500/5 hover:border-violet-500/30" },
  { emoji: "⭐", name: "Rising Star", range: "25K – 100K", bg: "hover:bg-blue-500/5 hover:border-blue-500/30" },
  { emoji: "🔥", name: "Main Character", range: "100K – 500K", bg: "hover:bg-amber-500/5 hover:border-amber-500/30" },
  { emoji: "👑", name: "Legendary", range: "500K – 1M", bg: "hover:bg-yellow-500/5 hover:border-yellow-500/30" },
  { emoji: "⚡", name: "Mythical", range: "1M – 5M", bg: "hover:bg-purple-500/5 hover:border-purple-500/30" },
  { emoji: "🌟", name: "GOD MODE", range: "5M+", bg: "hover:bg-amber-400/10 hover:border-amber-400/40" },
];

const stats = [
  { value: "50K+", label: "Aura Events Logged", icon: TrendingUp },
  { value: "12K+", label: "Active Users", icon: Users },
  { value: "4.8★", label: "User Rating", icon: Star },
];

const mockCalculations = [
  {
    keywords: ["bill", "paid", "everyone", "treat", "money", "dost"],
    points: 5000,
    emoji: "👑",
    tag: "Aura Rich Flex",
    verdict: "Paisa hi paisa! Absolute main character behaviour. Big flex, but check your bank balance later 💀"
  },
  {
    keywords: ["walked out", "left", "group chat", "chat", "bye"],
    points: 1500,
    emoji: "🗿",
    tag: "Sigma Status",
    verdict: "Pure power move. Left without explaining anything. NPC levels dropped to zero 🤫"
  },
  {
    keywords: ["sunglasses", "inside", "indoors"],
    points: -1200,
    emoji: "💀",
    tag: "Extreme Cringe Arc",
    verdict: "Bro thinks he's in a sci-fi film. Squinting inside is a massive NPC L. Take them off 🕶️"
  },
  {
    keywords: ["voice", "cracked", "presentation", "public"],
    points: -3500,
    emoji: "😬",
    tag: "Public Execution",
    verdict: "Arre yaar... sabke saamne? Voice crack is character building, but currently you're an NPC 💀"
  },
  {
    keywords: ["gym", "lift", "workout", "dumbbell", "exercise"],
    points: 2500,
    emoji: "💪",
    tag: "Gym Arc Active",
    verdict: "Main character gains. Consistent efforts fr fr. The gods are impressed 🔱"
  }
];

const getCustomRating = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const isPositive = hash % 2 === 0;
  const points = isPositive ? (Math.abs(hash) % 4000) + 500 : -((Math.abs(hash) % 4000) + 500);
  
  const positiveVerdicts = [
    "Vibe match successfully detected. High-level energy fr. Main character energy fr 👑",
    "Sigma aura levels rising. The crowd stands up. W decision ⚡",
    "God mode parameters unlocked. Extremely iconic energy. Flex it! 🌟",
    "Crushing it king/queen. Respect successfully generated 🗿"
  ];
  
  const negativeVerdicts = [
    "Ouch... that was painful. NPC traits found. Aura points have departed the chat 💀",
    "Absolute L. Sab log dekh rahe hain bro. Therapy arc starts now 😬",
    "Main character license revoked. Try holding the door next time 😐",
    "Cringe detected. Vibe check has returned zero results 💀"
  ];
  
  const verdicts = isPositive ? positiveVerdicts : negativeVerdicts;
  const verdict = verdicts[Math.abs(hash) % verdicts.length];
  const tags = isPositive ? ["Iconic Energy", "W Move", "Peak Behavior", "Alpha Flex"] : ["NPC Arc", "Glitch in Vibe", "Cringe Alert", "Down Bad"];
  const tag = tags[Math.abs(hash) % tags.length];
  const emojis = isPositive ? ["👑", "⚡", "🌟", "🔥", "💪"] : ["💀", "🗿", "😐", "😬"];
  const emoji = emojis[Math.abs(hash) % emojis.length];
  
  return { points, emoji, verdict, tag };
};

export default function LandingPage() {
  const { theme, setTheme } = useTheme();
  const [demoInput, setDemoInput] = useState("");
  const [demoStatus, setDemoStatus] = useState<"idle" | "loading" | "success">("idle");
  const [demoLoadingText, setDemoLoadingText] = useState("Analyzing vibe checks...");
  const [demoResult, setDemoResult] = useState<{ points: number; emoji: string; verdict: string; tag: string } | null>(null);

  async function handleDemoCalculate() {
    if (!demoInput.trim()) return;
    playHapticPop();
    setDemoStatus("loading");
    setDemoLoadingText("Analyzing vibe checks...");
    
    // Staggered premium loader feels extremely smart and high status!
    const loaders = [
      "Consulting standard vibe models...",
      "Calculating absolute main character thresholds...",
      "Analyzing potential cringe outputs...",
      "Generating savage verdict summary..."
    ];
    
    for (let i = 0; i < loaders.length; i++) {
      await new Promise((r) => setTimeout(r, 600));
      setDemoLoadingText(loaders[i]);
    }
    
    // Parse match
    const lowerInput = demoInput.toLowerCase();
    const match = mockCalculations.find(mc => mc.keywords.some(kw => lowerInput.includes(kw)));
    
    const resultData = match ? {
      points: match.points,
      emoji: match.emoji,
      verdict: match.verdict,
      tag: match.tag
    } : getCustomRating(demoInput);
    
    setDemoResult(resultData);
    if (resultData.points >= 0) {
      playAuraGainSound();
    } else {
      playAuraLossSound();
    }
    setDemoStatus("success");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent">
      {/* ─── Background Premium FX ─── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        {/* Animated Twinkling Stars */}
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="star absolute rounded-full bg-primary/20"
            style={{
              width: `${1 + Math.random() * 2}px`,
              height: `${1 + Math.random() * 2}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              ["--dur" as string]: `${3 + Math.random() * 4}s`,
              ["--del" as string]: `${Math.random() * 3}s`,
            }}
          />
        ))}
        {/* Glow blobs */}
        <div className="absolute -top-60 left-1/4 h-[800px] w-[800px] rounded-full bg-primary/[0.03] blur-[180px]" />
        <div className="absolute top-1/3 right-1/4 h-[600px] w-[600px] rounded-full bg-accent/[0.03] blur-[160px]" />
      </div>

      {/* ─── HEADER ─── */}
      <header className="relative z-30 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-12">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 border border-primary/10 shadow-sm">
            <Crown className="h-[20px] w-[20px] text-primary" />
          </div>
          <span className="heading text-2xl tracking-tighter grad-text">AuraMint</span>
        </Link>

        <nav className="hidden items-center gap-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:flex">
          <a href="#features" className="transition hover:text-foreground">Features</a>
          <a href="#tiers" className="transition hover:text-foreground">Tiers</a>
          <a href="#pricing" className="transition hover:text-foreground">Premium</a>
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-xl border border-border/30 bg-card/20 p-2.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link
            href="/login"
            className="hidden rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground transition hover:text-foreground sm:block"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-2xl bg-primary px-6 py-3.5 text-xs font-extrabold uppercase tracking-wider text-primary-foreground transition hover:brightness-110 shadow-lg glow-brand"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* ─── HERO SECTION ─── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-16 pb-20 text-center lg:pt-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Tagline Badge */}
          <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.08] px-5 py-2 text-[11px] font-bold uppercase tracking-widest text-primary shadow-sm">
            <Sparkles className="h-3 w-3" />
            India&apos;s First AI Aura Tracker
            <ChevronRight className="h-3 w-3" />
          </div>

          <h1 className="heading text-[clamp(2.5rem,7vw,5rem)] leading-[0.95] tracking-tight">
            Every moment has <br />
            an <span className="grad-gold">aura</span>
            <span className="text-muted-foreground/40 font-light"> — do you know yours?</span>
          </h1>

          <p className="mx-auto mt-8 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Log daily life events. AI rates them with{" "}
            <span className="font-semibold text-foreground">dramatic aura points</span> and savage
            Hinglish verdicts. Compete on leaderboards. Share viral cards.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="flex items-center gap-3 rounded-2xl bg-primary px-8 py-4.5 text-xs font-extrabold uppercase tracking-wider text-primary-foreground transition hover:scale-[1.02] hover:brightness-110 glow-brand w-full sm:w-auto justify-center"
            >
              Start Free — No Credit Card
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card/20 px-7 py-4.5 text-xs font-bold uppercase tracking-wider transition hover:bg-secondary w-full sm:w-auto justify-center"
            >
              See How It Works
            </a>
          </div>

          {/* Interactive Simulated Bento Widget */}
          <div className="mx-auto mt-16 max-w-lg text-left glass-grain glass noise border border-border/40 p-6 sm:p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
            <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
            <div className="relative z-10 flex items-center justify-between mb-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-primary">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                Live AI Aura Calculator Demo
              </span>
              <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Instant Vibe Check</span>
            </div>
            
            <div className="relative z-10 flex gap-2">
              <input
                type="text"
                value={demoInput}
                onChange={(e) => setDemoInput(e.target.value)}
                placeholder="Left my group chat without saying bye..."
                className="flex-1 rounded-2xl border border-border/80 bg-secondary/15 px-4 py-3.5 text-xs font-semibold placeholder:text-muted-foreground/45 focus:border-primary/50 focus:bg-secondary/35 focus:outline-none"
              />
              <button
                onClick={handleDemoCalculate}
                className="rounded-2xl bg-primary px-5 py-3.5 text-xs font-extrabold uppercase tracking-wider text-primary-foreground transition hover:scale-[1.02] hover:brightness-110 active:scale-98 shadow-lg glow-brand"
              >
                Rate It
              </button>
            </div>
            
            <AnimatePresence mode="wait">
              {demoStatus === "loading" && (
                <motion.div
                  key="loader"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-6 rounded-2xl border border-border/20 bg-secondary/10 p-5 text-center flex flex-col items-center justify-center gap-3"
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
                  className={`mt-6 border p-5 rounded-2xl ${
                    demoResult.points > 0 ? "glow-win bg-emerald-950/10" : "glow-loss bg-red-950/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      demoResult.points > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                    }`}>
                      {demoResult.tag}
                    </span>
                    <PremiumIcon emoji={demoResult.emoji} className="h-6 w-6" />
                  </div>
                  
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className={`mono text-3xl font-black tracking-tighter ${
                      demoResult.points > 0 ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {demoResult.points > 0 ? "+" : ""}
                      {demoResult.points.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Aura Points</span>
                  </div>
                  
                  <p className="mt-3 text-xs sm:text-sm font-semibold leading-relaxed border-t border-border/30 pt-3 italic text-muted-foreground">
                    &ldquo;{demoResult.verdict}&rdquo;
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ─── SAMPLE DYNAMIC FEED CARDS ─── */}
        <div className="mt-24 grid gap-6 sm:grid-cols-3">
          {sampleEvents.map((ev, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40, rotate: i === 1 ? 0 : i === 0 ? -2 : 2 }}
              animate={{ opacity: 1, y: 0, rotate: i === 1 ? 0 : i === 0 ? -2 : 2 }}
              transition={{ delay: 0.2 + i * 0.15, duration: 0.6, ease: "easeOut" }}
              whileHover={{ rotate: 0, y: -6, transition: { duration: 0.25 } }}
              className={`glass noise relative p-7 text-left ${
                ev.points > 0 ? "glow-win" : "glow-loss"
              }`}
            >
              <div className="relative z-10 flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
                  <Sparkles className="h-2.5 w-2.5" />
                  {ev.tag}
                </span>
                <PremiumIcon emoji="👑" className="h-4 w-4" />
              </div>
              <p className="relative z-10 text-sm font-medium leading-relaxed min-h-[48px]">{ev.text}</p>
              <div className="relative z-10 mt-6 flex items-baseline gap-2">
                <span
                  className={`mono text-3xl font-black tracking-tighter ${
                    ev.points > 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {ev.points > 0 ? "+" : ""}
                  {ev.points.toLocaleString()}
                </span>
                <PremiumIcon emoji={ev.emoji} className="h-7 w-7 animate-bounce" />
              </div>
              <p className="relative z-10 mt-4 border-t border-border/40 pt-4 text-xs italic text-muted-foreground leading-relaxed">
                &ldquo;{ev.verdict}&rdquo;
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── SOCIAL STATS ─── */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 py-12">
        <div className="glass noise grid grid-cols-3 gap-6 p-8 text-center rounded-3xl border border-border/30">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
              className="flex flex-col items-center"
            >
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="h-4 w-4" />
              </div>
              <p className="heading text-2xl grad-gold sm:text-3xl leading-none">{s.value}</p>
              <p className="mt-1.5 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── FEATURES GRID ─── */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-primary">Why AuraMint</p>
          <h2 className="heading mt-3 text-3xl sm:text-4xl tracking-tight leading-none">
            Everything you need to flex <span className="grad-text">your energy</span>
          </h2>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
              className={`glass noise relative overflow-hidden p-8 border border-border/40 transition-all ${f.borderColor}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${f.color} opacity-40`} />
              <div className="relative z-10">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/5 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="heading text-xl tracking-tight">{f.title}</h3>
                <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── TIERS PROGRESSION ─── */}
      <section id="tiers" className="relative z-10 mx-auto max-w-5xl px-6 py-24">
        <div className="mb-16 text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-primary">Progression</p>
          <h2 className="heading mt-3 text-3xl sm:text-4xl tracking-tight">
            Journey from <span className="text-muted-foreground/50">NPC</span> to{" "}
            <span className="grad-gold">GOD MODE</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {tiers.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              viewport={{ once: true }}
              className={`glass p-5 text-center transition-all ${t.bg}`}
            >
              <PremiumIcon emoji={t.emoji} className="h-10 w-10 mx-auto mb-3" />
              <p className="heading mt-3 text-xs tracking-tight">{t.name}</p>
              <p className="mono mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{t.range}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 py-28 text-center bg-radial from-primary/[0.03] to-transparent">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col items-center"
        >
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 border border-primary/10 shadow-xl aura-orb">
            <Crown className="h-8 w-8 text-primary" />
          </div>
          <h2 className="heading text-3xl sm:text-4xl tracking-tight leading-tight">
            Ready to discover <br />
            your <span className="grad-gold">aura</span>?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            Join thousands of Gen-Z users flexing their aura scores. Free forever. No ads on feed.
          </p>
          <Link
            href="/signup"
            className="mt-8 flex items-center gap-2.5 rounded-2xl bg-primary px-10 py-5 text-xs font-extrabold uppercase tracking-wider text-primary-foreground transition hover:scale-[1.03] hover:brightness-110 shadow-lg glow-brand"
          >
            <Sparkles className="h-4 w-4" />
            Start Your Aura Journey
          </Link>
        </motion.div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="relative z-10 border-t border-border/30 py-12 text-center bg-card/10">
        <div className="flex items-center justify-center gap-2.5 mb-4">
          <Crown className="h-5 w-5 text-primary" />
          <span className="heading text-base tracking-tight grad-text">AuraMint</span>
        </div>
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
