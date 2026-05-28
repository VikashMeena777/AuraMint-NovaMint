"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
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
    color: "from-amber-500/20 to-orange-500/20",
  },
  {
    icon: Trophy,
    title: "Leaderboards",
    desc: "Climb from NPC to GOD MODE. Daily, weekly, and all-time rankings",
    color: "from-violet-500/20 to-purple-500/20",
  },
  {
    icon: Share2,
    title: "Viral Cards",
    desc: "Every verdict becomes a share-ready card for TikTok, Reels & WhatsApp",
    color: "from-emerald-500/20 to-teal-500/20",
  },
  {
    icon: Flame,
    title: "Streaks & Tiers",
    desc: "Daily streaks, bonus aura, 7 progression tiers, and collectible badges",
    color: "from-rose-500/20 to-red-500/20",
  },
];

const tiers = [
  { emoji: "💀", name: "Negative Aura", range: "< 0" },
  { emoji: "🗿", name: "NPC", range: "0 – 5K" },
  { emoji: "😐", name: "Civilian", range: "5K – 25K" },
  { emoji: "⭐", name: "Rising Star", range: "25K – 100K" },
  { emoji: "🔥", name: "Main Character", range: "100K – 500K" },
  { emoji: "👑", name: "Legendary", range: "500K – 1M" },
  { emoji: "⚡", name: "Mythical", range: "1M – 5M" },
  { emoji: "🌟", name: "GOD MODE", range: "5M+" },
];

const stats = [
  { value: "50K+", label: "Aura Events Logged", icon: TrendingUp },
  { value: "12K+", label: "Active Users", icon: Users },
  { value: "4.8★", label: "User Rating", icon: Star },
];

export default function LandingPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* ─── Background Layer ─── */}
      <div className="pointer-events-none fixed inset-0">
        {/* Stars */}
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="star absolute rounded-full bg-primary/30"
            style={{
              width: `${1 + Math.random() * 2}px`,
              height: `${1 + Math.random() * 2}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              ["--dur" as string]: `${2 + Math.random() * 4}s`,
              ["--del" as string]: `${Math.random() * 3}s`,
            }}
          />
        ))}
        {/* Gradient blobs */}
        <div className="absolute -top-40 left-1/4 h-[600px] w-[600px] rounded-full bg-primary/[0.04] blur-[160px]" />
        <div className="absolute -bottom-40 right-1/4 h-[500px] w-[500px] rounded-full bg-accent/[0.04] blur-[140px]" />
      </div>

      {/* ─── NAV ─── */}
      <header className="relative z-30 mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Crown className="h-[18px] w-[18px] text-primary" />
          </div>
          <span className="heading text-xl grad-text">AuraMint</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <a href="#features" className="transition hover:text-foreground">Features</a>
          <a href="#tiers" className="transition hover:text-foreground">Tiers</a>
          <a href="#pricing" className="transition hover:text-foreground">Premium</a>
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-xl p-2.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link
            href="/login"
            className="hidden rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground sm:block"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 glow-brand"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-12 pb-16 text-center lg:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Pill */}
          <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-4 py-1.5 text-xs font-medium text-primary">
            <Sparkles className="h-3 w-3" />
            India&apos;s First AI Aura Tracker
            <ChevronRight className="h-3 w-3" />
          </div>

          <h1 className="heading text-[clamp(2.2rem,6vw,4.5rem)] leading-[1.08]">
            Every moment has an{" "}
            <span className="grad-gold">aura</span>
            <br className="hidden sm:block" />
            <span className="text-muted-foreground"> — do you know yours?</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Log daily life events. AI rates them with{" "}
            <span className="font-semibold text-foreground">dramatic aura points</span> and savage
            Hinglish verdicts. Compete on leaderboards. Share viral cards.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="flex items-center gap-2.5 rounded-2xl bg-primary px-8 py-4 text-sm font-bold text-primary-foreground transition hover:brightness-110 hover:scale-[1.02] glow-brand"
            >
              Start Free — No Credit Card
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="flex items-center gap-2 rounded-2xl border border-border px-6 py-4 text-sm font-medium transition hover:bg-secondary"
            >
              See How It Works
            </a>
          </div>
        </motion.div>

        {/* ─── SAMPLE CARDS ─── */}
        <div className="mt-20 grid gap-5 sm:grid-cols-3">
          {sampleEvents.map((ev, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30, rotate: i === 1 ? 0 : i === 0 ? -1.5 : 1.5 }}
              animate={{ opacity: 1, y: 0, rotate: i === 1 ? 0 : i === 0 ? -1.5 : 1.5 }}
              transition={{ delay: 0.3 + i * 0.12, duration: 0.5 }}
              whileHover={{ rotate: 0, y: -4, transition: { duration: 0.2 } }}
              className={`glass noise relative p-6 text-left ${
                ev.points > 0 ? "glow-win" : "glow-loss"
              }`}
            >
              <p className="relative z-10 text-sm leading-relaxed">{ev.text}</p>
              <div className="relative z-10 mt-4 flex items-center gap-2.5">
                <span
                  className={`mono text-3xl font-extrabold tracking-tighter ${
                    ev.points > 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {ev.points > 0 ? "+" : ""}
                  {ev.points.toLocaleString()}
                </span>
                <span className="text-2xl">{ev.emoji}</span>
              </div>
              <div className="relative z-10 mt-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent">
                  <Sparkles className="h-2.5 w-2.5" />
                  {ev.tag}
                </span>
              </div>
              <p className="relative z-10 mt-3 text-xs italic text-muted-foreground leading-relaxed">
                &ldquo;{ev.verdict}&rdquo;
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── SOCIAL PROOF ─── */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 py-16">
        <div className="grid grid-cols-3 gap-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <p className="heading text-3xl grad-gold sm:text-4xl">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-14 text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Why AuraMint</p>
          <h2 className="heading mt-3 text-3xl sm:text-4xl">
            Everything you need to flex your <span className="grad-text">energy</span>
          </h2>
        </motion.div>

        <div className="grid gap-5 sm:grid-cols-2">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              viewport={{ once: true }}
              className="glass noise relative overflow-hidden p-7"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${f.color} opacity-40`} />
              <div className="relative z-10">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="heading text-lg">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── TIERS ─── */}
      <section id="tiers" className="relative z-10 mx-auto max-w-5xl px-6 py-20">
        <div className="mb-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Progression</p>
          <h2 className="heading mt-3 text-3xl sm:text-4xl">
            Your journey from <span className="text-muted-foreground">NPC</span> to{" "}
            <span className="grad-gold">GOD MODE</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiers.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06 }}
              viewport={{ once: true }}
              className="glass p-4 text-center transition hover:scale-105"
            >
              <span className="text-3xl">{t.emoji}</span>
              <p className="heading mt-2 text-sm">{t.name}</p>
              <p className="mono mt-0.5 text-[11px] text-muted-foreground">{t.range}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 aura-orb">
            <Crown className="h-7 w-7 text-primary" />
          </div>
          <h2 className="heading text-3xl sm:text-4xl">
            Ready to discover your <span className="grad-gold">aura</span>?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">
            Join thousands of Gen-Z users flexing their aura scores. Free forever. No ads on feed.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex items-center gap-2.5 rounded-2xl bg-primary px-10 py-4 text-sm font-bold text-primary-foreground transition hover:brightness-110 hover:scale-[1.02] glow-brand"
          >
            <Sparkles className="h-4 w-4" />
            Start Your Aura Journey
          </Link>
        </motion.div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="relative z-10 border-t border-border/50 py-10 text-center">
        <div className="flex items-center justify-center gap-2">
          <Crown className="h-4 w-4 text-primary" />
          <span className="heading text-sm grad-text">AuraMint</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Built with 💛 by{" "}
          <a href="https://novamintnetworks.in" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
            NovaMint Networks
          </a>
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground/60">
          © {new Date().getFullYear()} AuraMint. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
