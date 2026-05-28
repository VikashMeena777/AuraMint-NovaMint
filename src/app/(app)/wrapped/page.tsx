"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  Crown, 
  Flame, 
  TrendingUp, 
  TrendingDown, 
  ChevronRight, 
  ChevronLeft, 
  Share2, 
  ArrowLeft, 
  Trophy 
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn, formatAuraPoints } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { PremiumIcon } from "@/components/aura/premium-icon";
import { playHapticPop, playAuraGainSound, playPremiumUpgradeSound } from "@/lib/utils/sound";
import { QRCodeSVG } from "qrcode.react";

type WrappedStats = {
  totalAura: number;
  eventsCount: number;
  streak: number;
  biggestW: { text: string; points: number } | null;
  biggestL: { text: string; points: number } | null;
  archetype: string;
  dominantCategory: string;
};

export default function AuraWrappedPage() {
  const [stats, setStats] = useState<WrappedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const router = useRouter();

  useEffect(() => {
    async function loadWrappedData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // Fetch profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("total_aura, current_tier, streak_days, username, display_name")
        .eq("id", user.id)
        .single();

      const p = profile as any;

      // Fetch last 30 days events
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: events } = await supabase
        .from("aura_events")
        .select("description, aura_points, category")
        .eq("user_id", user.id)
        .gte("created_at", thirtyDaysAgo);

      const evts = events || [];
      
      // Calculate Ws/Ls
      let biggestW = null;
      let biggestL = null;
      let totalMonthlyAura = 0;
      const categories: Record<string, number> = {};

      for (const ev of evts) {
        totalMonthlyAura += ev.aura_points;
        categories[ev.category] = (categories[ev.category] || 0) + 1;

        if (ev.aura_points > 0) {
          if (!biggestW || ev.aura_points > biggestW.points) {
            biggestW = { text: ev.description, points: ev.aura_points };
          }
        } else if (ev.aura_points < 0) {
          if (!biggestL || ev.aura_points < biggestL.points) {
            biggestL = { text: ev.description, points: ev.aura_points };
          }
        }
      }

      // Calculate dominant category
      let dominantCategory = "random";
      let maxCount = 0;
      for (const [cat, count] of Object.entries(categories)) {
        if (count > maxCount) {
          maxCount = count;
          dominantCategory = cat;
        }
      }

      // Calculate archetype
      let archetype = "The Balanced Civilian";
      if (dominantCategory === "gym") {
        archetype = "The Beast Mode Gym Chad";
      } else if (dominantCategory === "crush") {
        archetype = "The Romantic Therapy Candidate";
      } else if (dominantCategory === "work" || dominantCategory === "school") {
        archetype = "The Corporate Sigma";
      } else if (totalMonthlyAura > 25000) {
        archetype = "The Untouchable Main Character";
      } else if (totalMonthlyAura < 0) {
        archetype = "The Down-Bad NPC Archetype";
      }

      setStats({
        totalAura: totalMonthlyAura,
        eventsCount: evts.length,
        streak: p?.streak_days ?? 0,
        biggestW,
        biggestL,
        archetype,
        dominantCategory,
      });
      setLoading(false);
    }
    loadWrappedData();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <Sparkles className="h-10 w-10 text-primary animate-spin" />
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">
          Composing Cosmic Storyboard...
        </p>
      </div>
    );
  }

  if (!stats) return null;

  const slides = [
    // Slide 1: Welcome Intro
    {
      key: "intro",
      bg: "from-purple-950/40 via-indigo-900/10 to-purple-950/40",
      content: (
        <div className="text-center px-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 border border-primary/20 shadow-xl aura-orb select-none"
          >
            <Crown className="h-10 w-10 text-primary" />
          </motion.div>
          <motion.h2 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="heading text-4xl sm:text-5xl leading-none grad-text"
          >
            Aura Wrapped
          </motion.h2>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mt-3.5 text-xs font-extrabold uppercase tracking-widest text-muted-foreground/60"
          >
            Your monthly energy arpeggio summary
          </motion.p>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="mt-8 mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground"
          >
            A month of logs, roasts, and triumphs summarized into one premium cosmic storyboard. Let&apos;s see how you vibe.
          </motion.p>
        </div>
      )
    },
    // Slide 2: Monthly Energy Stats
    {
      key: "stats",
      bg: "from-blue-950/40 via-cyan-900/10 to-blue-950/40",
      content: (
        <div className="text-center px-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 px-3.5 py-1.5 text-[9px] font-extrabold uppercase tracking-widest text-blue-400 mb-6">
            <TrendingUp className="h-3.5 w-3.5 animate-pulse" />
            Vibe Metrics
          </span>
          <h3 className="heading text-xl text-foreground">In the last 30 days...</h3>
          <p className="mt-1.5 text-xs text-muted-foreground">You logged a total of {stats.eventsCount} events</p>
          
          <div className="mt-8 grid gap-4 max-w-sm mx-auto">
            <div className="glass noise p-5 text-left border border-border/30 rounded-2xl">
              <span className="text-[9px] font-extrabold tracking-wider text-muted-foreground/50 uppercase block">Monthly Score</span>
              <span className={cn(
                "mono text-3xl font-black mt-1 leading-none block",
                stats.totalAura >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {stats.totalAura >= 0 ? "+" : ""}{formatAuraPoints(stats.totalAura)}
              </span>
            </div>
            
            <div className="glass noise p-5 text-left border border-border/30 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[9px] font-extrabold tracking-wider text-muted-foreground/50 uppercase block">Active Streak</span>
                <span className="mono text-2xl font-black text-orange-400 mt-1 leading-none block">{stats.streak} Days</span>
              </div>
              <Flame className="h-8 w-8 text-orange-400 animate-pulse shrink-0" />
            </div>
          </div>
        </div>
      )
    },
    // Slide 3: Biggest W of the Month
    {
      key: "biggest-w",
      bg: "from-emerald-950/40 via-teal-900/10 to-emerald-950/40",
      content: (
        <div className="text-center px-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 text-[9px] font-extrabold uppercase tracking-widest text-emerald-400 mb-6">
            <TrendingUp className="h-3.5 w-3.5 animate-bounce" />
            Peak Main Character Moment
          </span>
          <h3 className="heading text-xl text-foreground">Your Biggest W</h3>

          {stats.biggestW ? (
            <div className="mt-8 glass noise glow-win p-6 text-left border rounded-2xl max-w-sm mx-auto">
              <p className="text-xs sm:text-sm font-semibold leading-relaxed text-foreground">&ldquo;{stats.biggestW.text}&rdquo;</p>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="mono text-4xl font-black text-emerald-400 tracking-tighter">+{stats.biggestW.points.toLocaleString()}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">Aura</span>
              </div>
            </div>
          ) : (
            <p className="mt-12 text-xs text-muted-foreground/80 italic max-w-xs mx-auto">
              No positive aura events logged this month. Is it a therapy arc bro? 💀
            </p>
          )}
        </div>
      )
    },
    // Slide 4: Biggest L of the Month
    {
      key: "biggest-l",
      bg: "from-red-950/40 via-rose-900/10 to-red-950/40",
      content: (
        <div className="text-center px-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/20 px-3.5 py-1.5 text-[9px] font-extrabold uppercase tracking-widest text-red-400 mb-6">
            <TrendingDown className="h-3.5 w-3.5 animate-bounce" />
            NPC Level Spill
          </span>
          <h3 className="heading text-xl text-foreground">Your Biggest L</h3>

          {stats.biggestL ? (
            <div className="mt-8 glass noise glow-loss p-6 text-left border rounded-2xl max-w-sm mx-auto">
              <p className="text-xs sm:text-sm font-semibold leading-relaxed text-foreground">&ldquo;{stats.biggestL.text}&rdquo;</p>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="mono text-4xl font-black text-red-400 tracking-tighter">{stats.biggestL.points.toLocaleString()}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">Aura</span>
              </div>
            </div>
          ) : (
            <p className="mt-12 text-xs text-muted-foreground/80 italic max-w-xs mx-auto">
              No negative aura events logged. Absolute god-tier civilian behavior 👑.
            </p>
          )}
        </div>
      )
    },
    // Slide 5: Character Archetype Card
    {
      key: "archetype",
      bg: "from-yellow-950/40 via-amber-900/10 to-yellow-950/40",
      content: (
        <div className="text-center px-4 w-full">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3.5 py-1.5 text-[9px] font-extrabold uppercase tracking-widest text-primary mb-6 animate-pulse">
            <Crown className="h-3.5 w-3.5" />
            Cosmic Persona
          </span>
          <h3 className="heading text-xl text-foreground mb-1">Your Vibe Archetype</h3>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none">Calculated cosmic analysis</p>

          <div className="mt-8 border-holographic p-[1px] rounded-3xl glow-gold max-w-xs mx-auto overflow-hidden">
            <div className="glass noise p-6 text-center border border-transparent bg-card/90 rounded-3xl">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/5 text-3xl shadow select-none">
                <PremiumIcon emoji={stats.dominantCategory === "gym" ? "💪" : stats.dominantCategory === "crush" ? "💕" : "👑"} className="h-10 w-10" />
              </div>
              <h4 className="heading text-base leading-tight grad-gold">{stats.archetype}</h4>
              <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/85">
                Your high activity in the <span className="font-extrabold text-foreground">{stats.dominantCategory}</span> segment maps you to this energy group. Keep flexing!
              </p>
            </div>
          </div>
        </div>
      )
    }
  ];

  function handleNextSlide() {
    playHapticPop();
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(s => s + 1);
    } else {
      playAuraGainSound();
      toast.success("Cosmic Wrapped slide deck completed! 🪐");
    }
  }

  function handlePrevSlide() {
    playHapticPop();
    if (currentSlide > 0) {
      setCurrentSlide(s => s - 1);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-2">
      {/* Back button */}
      <Link
        href="/dashboard"
        onClick={playHapticPop}
        className="mb-6 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-muted-foreground hover:text-foreground transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Dashboard
      </Link>

      {/* Slide frame container */}
      <div className="relative min-h-[55vh] flex flex-col justify-between overflow-hidden glass rounded-[2.5rem] border border-border/40 p-6 sm:p-8 bg-card/45 relative">
        
        {/* Saturated dynamic gradient orbs backdrop matching slide context */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className={cn("absolute inset-0 bg-gradient-to-br opacity-20 pointer-events-none transition-all duration-500", slides[currentSlide].bg)}
          />
        </AnimatePresence>

        {/* Story indicator progress ticks top bar */}
        <div className="relative z-10 flex gap-1 mb-6">
          {slides.map((_, i) => (
            <div key={i} className="flex-1 h-1.5 rounded-full overflow-hidden bg-secondary border border-border/5">
              <div 
                className={cn(
                  "h-full bg-primary transition-all duration-300",
                  i === currentSlide ? "w-full" : i < currentSlide ? "w-full bg-primary/40" : "w-0"
                )}
              />
            </div>
          ))}
        </div>

        {/* Dynamic Slide Content panel */}
        <div className="relative z-10 my-auto py-4 flex items-center justify-center min-h-[30vh]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ x: 30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -30, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-full flex justify-center"
            >
              {slides[currentSlide].content}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Slides controllers buttons */}
        <div className="relative z-10 flex items-center justify-between border-t border-border/20 pt-6 mt-4">
          <button
            onClick={handlePrevSlide}
            disabled={currentSlide === 0}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card/25 px-4.5 py-2.5 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          
          <button
            onClick={handleNextSlide}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-6 py-2.5 text-[10px] font-extrabold uppercase tracking-widest text-primary-foreground transition hover:brightness-110 active:scale-98 shadow-md"
          >
            <span>{currentSlide === slides.length - 1 ? "Finish" : "Next"}</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
