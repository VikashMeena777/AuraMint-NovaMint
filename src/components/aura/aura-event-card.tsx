"use client";

import { motion } from "framer-motion";
import { Sparkles, ArrowUp, ArrowDown, Share2 } from "lucide-react";
import { cn, formatAuraPoints, timeAgo } from "@/lib/utils";
import { CATEGORIES } from "@/lib/ai/prompts";
import { useState } from "react";
import { reactToEvent, voteOnEvent } from "@/lib/actions/aura-actions";
import { toast } from "sonner";
import { ShareCardModal } from "@/components/aura/share-card-modal";
import { PremiumIcon } from "@/components/aura/premium-icon";

type AuraEvent = {
  id: string;
  description: string;
  aura_points: number;
  ai_verdict: string;
  ai_vibe_tag: string;
  ai_emoji: string;
  category: string;
  upvotes: number;
  downvotes: number;
  reaction_counts: Record<string, number>;
  created_at: string;
  profiles?: {
    username: string;
    display_name: string;
    avatar_url: string;
    current_tier: string;
    total_aura: number;
  };
};

const reactions = [
  { type: "crown", emoji: "👑" },
  { type: "skull", emoji: "💀" },
  { type: "fire", emoji: "🔥" },
  { type: "yikes", emoji: "😬" },
  { type: "iconic", emoji: "✨" },
  { type: "npc", emoji: "🗿" },
];

const tierEmojis: Record<string, string> = {
  "Negative Aura": "💀", NPC: "🗿", Civilian: "😐", "Rising Star": "⭐",
  "Main Character": "🔥", Legendary: "👑", Mythical: "⚡", "GOD MODE": "🌟",
};

export function AuraEventCard({ event, index = 0 }: { event: AuraEvent; index?: number }) {
  const [localReactions, setLocalReactions] = useState(event.reaction_counts || {});
  const [localUpvotes, setLocalUpvotes] = useState(event.upvotes);
  const [localDownvotes, setLocalDownvotes] = useState(event.downvotes);
  const [activeReaction, setActiveReaction] = useState<string | null>(null);
  const [userVote, setUserVote] = useState<1 | -1 | null>(null);
  const [showShareCard, setShowShareCard] = useState(false);

  const isPositive = event.aura_points >= 0;
  const isLegendary = Math.abs(event.aura_points) >= 5000;
  const category = CATEGORIES.find((c) => c.value === event.category);

  async function handleReaction(type: string) {
    const result = await reactToEvent(event.id, type);
    if (result.error) { toast.error(result.error); return; }
    if (result.action === "removed") {
      setActiveReaction(null);
      setLocalReactions((p) => ({ ...p, [type]: Math.max(0, (p[type] || 0) - 1) }));
    } else {
      if (activeReaction) setLocalReactions((p) => ({ ...p, [activeReaction]: Math.max(0, (p[activeReaction] || 0) - 1) }));
      setActiveReaction(type);
      setLocalReactions((p) => ({ ...p, [type]: (p[type] || 0) + 1 }));
    }
  }

  async function handleVote(value: 1 | -1) {
    const result = await voteOnEvent(event.id, value);
    if (result.error) { toast.error(result.error); return; }
    if (result.action === "removed") {
      if (value === 1) setLocalUpvotes((v) => v - 1); else setLocalDownvotes((v) => v - 1);
      setUserVote(null);
    } else {
      if (userVote) { if (userVote === 1) setLocalUpvotes((v) => v - 1); else setLocalDownvotes((v) => v - 1); }
      if (value === 1) setLocalUpvotes((v) => v + 1); else setLocalDownvotes((v) => v + 1);
      setUserVote(value);
    }
  }

  async function handleShare() {
    const text = `${event.ai_emoji} ${formatAuraPoints(event.aura_points)} aura\n\n"${event.description}"\n\n${event.ai_verdict}\n\n— AuraMint 👑`;
    const url = `${window.location.origin}/event/${event.id}`;
    if (navigator.share) {
      try { await navigator.share({ text, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast.success("Copied details to clipboard! 📋");
    }
  }

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut", delay: index * 0.05 }}
        className={cn(
          "glass noise relative overflow-hidden transition-all rounded-3xl border border-border/30",
          isLegendary && isPositive && "glow-gold",
          isLegendary && !isPositive && "glow-loss",
          !isLegendary && isPositive && "glow-win",
          !isLegendary && !isPositive && "glow-loss"
        )}
      >
        {/* Subtle radial backdrops matching scoring polarity */}
        <div className={cn(
          "absolute -right-24 -top-24 h-48 w-48 rounded-full blur-3xl opacity-35 pointer-events-none",
          isPositive ? "bg-emerald-500/10" : "bg-red-500/10"
        )} />

        {/* ── Header details ── */}
        <div className="relative z-10 flex items-center justify-between px-6 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/5 text-sm font-black text-primary shadow-sm">
              {event.profiles
                ? (event.profiles.display_name || event.profiles.username).charAt(0).toUpperCase()
                : "?"}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold leading-tight">
                  {event.profiles?.display_name || event.profiles?.username || "Anonymous"}
                </span>
                <PremiumIcon emoji={tierEmojis[event.profiles?.current_tier || "NPC"]} className="h-3.5 w-3.5" />
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground/60 leading-none">
                {timeAgo(event.created_at)}
              </span>
            </div>
          </div>
          {category && (
            <span className="rounded-full bg-secondary/50 border border-border/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <PremiumIcon emoji={category.emoji} className="h-3.5 w-3.5" />
              <span>{category.label}</span>
            </span>
          )}
        </div>

        {/* ── Description text ── */}
        <p className="relative z-10 px-6 pt-4 text-xs sm:text-sm font-medium leading-relaxed text-foreground/95">
          {event.description}
        </p>

        {/* ── Scored Points visual ── */}
        <div className="relative z-10 flex items-baseline gap-2.5 px-6 pt-4">
          <span className={cn(
            "heading text-3xl sm:text-4xl font-extrabold tracking-tighter leading-none grad-text",
            isPositive ? "text-emerald-400" : "text-red-400"
          )} style={{ fontFamily: "var(--font-display)" }}>
            {isPositive ? "+" : ""}
            {formatAuraPoints(event.aura_points)}
          </span>
          <PremiumIcon emoji={event.ai_emoji} className="h-7 w-7 animate-bounce" />
        </div>

        {/* ── Savagely quoted Verdict ── */}
        <div className="relative z-10 mx-6 mt-4 rounded-2xl bg-secondary/20 border border-border/30 p-4">
          <p className="text-[12px] italic leading-relaxed text-muted-foreground/90">
            &ldquo;{event.ai_verdict}&rdquo;
          </p>
        </div>

        {/* ── AI Vibe tag pill ── */}
        {event.ai_vibe_tag && (
          <div className="relative z-10 px-6 pt-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 border border-accent/20 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-accent">
              <Sparkles className="h-3 w-3" />
              {event.ai_vibe_tag}
            </span>
          </div>
        )}

        {/* ── User Reactions Pill selectors ── */}
        <div className="relative z-10 flex flex-wrap items-center gap-1.5 px-6 pt-5">
          {reactions.map((r) => (
            <button
              key={r.type}
              onClick={() => handleReaction(r.type)}
              className={cn(
                "flex items-center gap-1 rounded-2xl px-3 py-1.5 text-xs font-semibold transition-all border",
                activeReaction === r.type
                  ? "bg-primary/10 border-primary/20 text-primary shadow-sm"
                  : "bg-secondary/40 border-transparent hover:bg-secondary/70"
              )}
            >
              <span className="text-sm leading-none">{r.emoji}</span>
              <span className="mono text-[10px] font-bold text-muted-foreground/80">{localReactions[r.type] || 0}</span>
            </button>
          ))}
        </div>

        {/* ── Footer Interaction Controller ── */}
        <div className="relative z-10 mt-5 flex items-center justify-between border-t border-border/25 px-6 py-3.5 bg-secondary/10">
          {/* W / L Votes */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleVote(1)}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold uppercase tracking-wider transition-all border",
                userVote === 1
                  ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                  : "text-muted-foreground hover:bg-secondary/60 border-transparent"
              )}
            >
              <ArrowUp className="h-3.5 w-3.5" />
              <span>W</span>
              <span className="mono font-black">{localUpvotes}</span>
            </button>
            <button
              onClick={() => handleVote(-1)}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold uppercase tracking-wider transition-all border",
                userVote === -1
                  ? "bg-red-500/10 border-red-500/25 text-red-400"
                  : "text-muted-foreground hover:bg-secondary/60 border-transparent"
              )}
            >
              <ArrowDown className="h-3.5 w-3.5" />
              <span>L</span>
              <span className="mono font-black">{localDownvotes}</span>
            </button>
          </div>

          {/* Social shares */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowShareCard(true)}
              className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/15 px-3.5 py-2 text-xs font-extrabold uppercase tracking-wider text-primary transition hover:bg-primary/20 shadow-sm"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Card</span>
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 rounded-xl border border-border bg-card/25 px-3.5 py-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              Share
            </button>
          </div>
        </div>
      </motion.article>

      {/* Share card overlay popup dialog */}
      <ShareCardModal
        isOpen={showShareCard}
        onClose={() => setShowShareCard(false)}
        data={{
          description: event.description,
          aura_points: event.aura_points,
          ai_verdict: event.ai_verdict,
          ai_emoji: event.ai_emoji,
          ai_vibe_tag: event.ai_vibe_tag,
          username: event.profiles?.username || "anonymous",
          tier: event.profiles?.current_tier || "NPC",
          event_id: event.id,
        }}
      />
    </>
  );
}
