"use client";

import { useState, useEffect, use } from "react";
import { motion } from "framer-motion";
import { Crown, Trophy, Swords, Share2, ArrowLeft, Flame, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn, formatAuraPoints } from "@/lib/utils";
import { PremiumIcon } from "@/components/aura/premium-icon";
import { playHapticPop, playAuraGainSound } from "@/lib/utils/sound";
import { createClient } from "@/lib/supabase/client";

type ProfileData = {
  username: string;
  display_name: string;
  avatar_url: string;
  total_aura: number;
  current_tier: string;
  streak_days: number;
  is_premium: boolean;
};

export default function VersusPage({
  params: paramsPromise,
}: {
  params: Promise<{ user1: string; user2: string }>;
}) {
  const params = use(paramsPromise);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [player1, setPlayer1] = useState<ProfileData | null>(null);
  const [player2, setPlayer2] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDuelData() {
      const supabase = createClient();
      try {
        // Fetch player 1 profile
        const { data: p1, error: e1 } = await supabase
          .from("profiles")
          .select("username, display_name, avatar_url, total_aura, current_tier, streak_days, is_premium")
          .eq("username", params.user1)
          .single();

        // Fetch player 2 profile
        const { data: p2, error: e2 } = await supabase
          .from("profiles")
          .select("username, display_name, avatar_url, total_aura, current_tier, streak_days, is_premium")
          .eq("username", params.user2)
          .single();

        if (e1 || !p1) {
          setError(`User @${params.user1} not found`);
          setLoading(false);
          return;
        }
        if (e2 || !p2) {
          setError(`User @${params.user2} not found`);
          setLoading(false);
          return;
        }

        setPlayer1(p1 as ProfileData);
        setPlayer2(p2 as ProfileData);
      } catch (err) {
        setError("Failed to fetch duel data. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    loadDuelData();
  }, [params.user1, params.user2]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <Swords className="h-10 w-10 text-primary animate-spin" />
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">
          Simulating Clash Dynamics...
        </p>
      </div>
    );
  }

  if (error || !player1 || !player2) {
    return (
      <div className="glass noise p-8 text-center border border-border/30 rounded-3xl max-w-md mx-auto mt-12">
        <p className="text-sm font-bold text-destructive mb-4">{error || "Something went wrong"}</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-6 py-3 text-xs font-extrabold uppercase tracking-wider text-foreground hover:bg-secondary/80 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Feed
        </Link>
      </div>
    );
  }

  const p1Aura = player1.total_aura;
  const p2Aura = player2.total_aura;
  const delta = Math.abs(p1Aura - p2Aura);
  const p1Wins = p1Aura >= p2Aura;

  // Generate a savage Hinglish comparison verdict dynamically
  let comparativeVerdict = "";
  let subText = "";

  if (p1Aura === p2Aura) {
    comparativeVerdict = "Absolute mirror match. Both of these gods are vibrating on identical aura frequencies 🗿.";
    subText = "Equally Sigma. The universe is currently in perfect equilibrium.";
  } else if (p1Wins) {
    if (delta > 50000) {
      comparativeVerdict = `@${player1.username} completely dominates the clash. @${player2.username} is currently in a massive NPC therapy arc 💀.`;
      subText = "Aura delta is too massive. Absolute structural hierarchy.";
    } else {
      comparativeVerdict = `@${player1.username} holds the higher main character status. @${player2.username} needs to log more Ws immediately ⚡.`;
      subText = `Delta is only ${formatAuraPoints(delta)} points. Extremely sweepable.`;
    }
  } else {
    if (delta > 50000) {
      comparativeVerdict = `@${player2.username} resides in absolute God Mode compared to @${player1.username}. Major diff found 💀.`;
      subText = "NPC behavior detected. Rahul, E5 to C4 levels are slipping.";
    } else {
      comparativeVerdict = `@${player2.username} holds the crown. @${player1.username} is lagging behind by a thin margin ⚡.`;
      subText = `Delta is only ${formatAuraPoints(delta)} points. Rebound arc is active!`;
    }
  }

  function handleShareDuel() {
    playHapticPop();
    const text = `⚔️ AuraMint Duel Clash: @${player1?.username} vs @${player2?.username}\n\n🏆 Winner: @${p1Wins ? player1?.username : player2?.username} (${formatAuraPoints(p1Wins ? p1Aura : p2Aura)} aura)\n\n"${comparativeVerdict}"\n\nCompare your aura with mine now: ${window.location.origin}/vs/${player1?.username}/${player2?.username} 👑`;
    navigator.clipboard.writeText(text);
    toast.success("Duel scorecard copied! Go flex it on WhatsApp/Instagram Stories 🚀");
    playAuraGainSound();
  }

  return (
    <div className="mx-auto max-w-2xl px-2">
      {/* Back to Leaderboard */}
      <Link
        href="/leaderboard"
        onClick={playHapticPop}
        className="mb-6 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-muted-foreground hover:text-foreground transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Leaderboard
      </Link>

      {/* Page Header */}
      <div className="text-center mb-10">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/10 shadow-lg aura-orb">
          <Swords className="h-7 w-7 text-primary" />
        </div>
        <h1 className="heading text-3xl sm:text-4xl tracking-tight">
          Aura <span className="grad-gold">Duel Clash</span>
        </h1>
        <p className="mt-1.5 text-xs text-muted-foreground uppercase tracking-widest">1v1 Cosmic Vibe Confrontation</p>
      </div>

      {/* ─── Versus Grid Layout ─── */}
      <div className="grid gap-6 md:grid-cols-2 relative">
        {/* Central VS floating tag */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-background border-2 border-border shadow-lg font-black text-xs uppercase tracking-widest shrink-0 select-none hidden md:flex">
          VS
        </div>

        {/* Player 1 Card Component */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(
            "glass-grain glass noise p-6 text-center border relative overflow-hidden rounded-[2rem]",
            p1Wins ? "border-emerald-500/20 glow-win bg-emerald-950/5" : "border-border/30 opacity-80"
          )}
        >
          {p1Wins && (
            <div className="absolute top-4 left-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[8px] font-extrabold uppercase tracking-widest text-emerald-400">
              Leader
            </div>
          )}
          <div className="flex flex-col items-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/5 text-xl font-black text-primary mb-4 shadow-sm select-none">
              {(player1.display_name || player1.username).charAt(0).toUpperCase()}
            </div>
            <h3 className="heading text-lg leading-tight truncate max-w-full">{player1.display_name || player1.username}</h3>
            <p className="text-xs text-muted-foreground/60 font-semibold mt-0.5">@{player1.username}</p>

            <span className="mt-3.5 rounded-full bg-secondary/40 border border-border/20 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1">
              <PremiumIcon emoji={player1.current_tier === "GOD MODE" ? "🌟" : player1.current_tier === "Legendary" ? "👑" : "🔥"} className="h-3.5 w-3.5" />
              {player1.current_tier}
            </span>

            <div className="mt-6 border-t border-border/30 pt-5 w-full space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Total Aura Balance</p>
                <p className={cn(
                  "mono text-3xl font-black tracking-tighter mt-1 leading-none",
                  p1Wins ? "text-emerald-400" : "text-muted-foreground"
                )}>
                  {formatAuraPoints(player1.total_aura)}
                </p>
              </div>

              <div className="flex justify-center gap-6 text-xs font-semibold text-muted-foreground/80">
                <span className="flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5 text-orange-400" />
                  {player1.streak_days}d streak
                </span>
                {player1.is_premium && (
                  <span className="rounded-full bg-primary/15 border border-primary/25 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-primary">
                    PRO
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Player 2 Card Component */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(
            "glass-grain glass noise p-6 text-center border relative overflow-hidden rounded-[2rem]",
            !p1Wins ? "border-emerald-500/20 glow-win bg-emerald-950/5" : "border-border/30 opacity-80"
          )}
        >
          {!p1Wins && (
            <div className="absolute top-4 left-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[8px] font-extrabold uppercase tracking-widest text-emerald-400">
              Leader
            </div>
          )}
          <div className="flex flex-col items-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/5 text-xl font-black text-primary mb-4 shadow-sm select-none">
              {(player2.display_name || player2.username).charAt(0).toUpperCase()}
            </div>
            <h3 className="heading text-lg leading-tight truncate max-w-full">{player2.display_name || player2.username}</h3>
            <p className="text-xs text-muted-foreground/60 font-semibold mt-0.5">@{player2.username}</p>

            <span className="mt-3.5 rounded-full bg-secondary/40 border border-border/20 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1">
              <PremiumIcon emoji={player2.current_tier === "GOD MODE" ? "🌟" : player2.current_tier === "Legendary" ? "👑" : "🔥"} className="h-3.5 w-3.5" />
              {player2.current_tier}
            </span>

            <div className="mt-6 border-t border-border/30 pt-5 w-full space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Total Aura Balance</p>
                <p className={cn(
                  "mono text-3xl font-black tracking-tighter mt-1 leading-none",
                  !p1Wins ? "text-emerald-400" : "text-muted-foreground"
                )}>
                  {formatAuraPoints(player2.total_aura)}
                </p>
              </div>

              <div className="flex justify-center gap-6 text-xs font-semibold text-muted-foreground/80">
                <span className="flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5 text-orange-400" />
                  {player2.streak_days}d streak
                </span>
                {player2.is_premium && (
                  <span className="rounded-full bg-primary/15 border border-primary/25 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-primary">
                    PRO
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ─── Comparative Savage Verdict Bento Box ─── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6 glass noise p-6 border border-border/40 rounded-3xl relative overflow-hidden"
      >
        <div className="absolute -left-12 -top-12 h-20 w-20 rounded-full bg-primary/5 blur-xl pointer-events-none" />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider text-primary mb-3">
          <Crown className="h-3 w-3" />
          Aura Clash Resolution
        </span>
        <h4 className="heading text-sm tracking-tight text-foreground leading-normal mt-1">
          {comparativeVerdict}
        </h4>
        <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">{subText}</p>
      </motion.div>

      {/* Share Scorecard Trigger */}
      <button
        onClick={handleShareDuel}
        className="mt-8 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-primary py-4.5 text-xs font-extrabold uppercase tracking-wider text-primary-foreground transition hover:brightness-110 shadow-lg glow-brand"
      >
        <Share2 className="h-4.5 w-4.5" />
        Share Scorecard & Flex
      </button>
    </div>
  );
}
