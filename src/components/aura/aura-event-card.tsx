"use client";

import { motion } from "framer-motion";
import { Sparkles, ArrowUp, ArrowDown, Share2, MoreHorizontal } from "lucide-react";
import { cn, formatAuraPoints, timeAgo } from "@/lib/utils";
import { CATEGORIES } from "@/lib/ai/prompts";
import { useState } from "react";
import { reactToEvent, voteOnEvent } from "@/lib/actions/aura-actions";
import { toast } from "sonner";
import { ShareCardModal } from "@/components/aura/share-card-modal";

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
    if (navigator.share) { try { await navigator.share({ text, url }); } catch {} }
    else { await navigator.clipboard.writeText(`${text}\n${url}`); toast.success("Copied! 📋"); }
  }

  function handleShareCard() {
    setShowShareCard(true);
  }

  return (
    <>
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      className={cn(
        "glass noise relative overflow-hidden transition-all",
        isLegendary && isPositive && "glow-gold",
        isLegendary && !isPositive && "glow-loss",
        !isLegendary && isPositive && "glow-win",
        !isLegendary && !isPositive && "glow-loss"
      )}
    >
      {/* ── Header ── */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {event.profiles
              ? (event.profiles.display_name || event.profiles.username).charAt(0).toUpperCase()
              : "?"}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-semibold">
                {event.profiles?.display_name || event.profiles?.username || "Anonymous"}
              </span>
              <span className="text-sm">{tierEmojis[event.profiles?.current_tier || "NPC"]}</span>
            </div>
            <span className="text-[11px] text-muted-foreground">{timeAgo(event.created_at)}</span>
          </div>
        </div>
        {category && (
          <span className="rounded-full bg-secondary/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {category.emoji} {category.label}
          </span>
        )}
      </div>

      {/* ── Body ── */}
      <p className="relative z-10 px-5 pt-3 text-[14px] leading-relaxed">{event.description}</p>

      {/* ── Points (dramatic) ── */}
      <div className="relative z-10 flex items-baseline gap-2.5 px-5 pt-4">
        <span className={cn(
          "mono text-[32px] font-extrabold tracking-tighter leading-none",
          isPositive ? "text-emerald-400" : "text-red-400"
        )}>
          {formatAuraPoints(event.aura_points)}
        </span>
        <span className="text-2xl">{event.ai_emoji}</span>
      </div>

      {/* ── Verdict ── */}
      <p className="relative z-10 px-5 pt-2 text-[12.5px] italic leading-relaxed text-muted-foreground">
        &ldquo;{event.ai_verdict}&rdquo;
      </p>

      {/* ── Vibe Tag ── */}
      {event.ai_vibe_tag && (
        <div className="relative z-10 px-5 pt-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent">
            <Sparkles className="h-2.5 w-2.5" />
            {event.ai_vibe_tag}
          </span>
        </div>
      )}

      {/* ── Reactions ── */}
      <div className="relative z-10 flex flex-wrap items-center gap-1.5 px-5 pt-4">
        {reactions.map((r) => (
          <button
            key={r.type}
            onClick={() => handleReaction(r.type)}
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition-all",
              activeReaction === r.type
                ? "bg-primary/10 ring-1 ring-primary/20 font-semibold"
                : "bg-secondary/40 hover:bg-secondary/70"
            )}
          >
            <span className="text-sm">{r.emoji}</span>
            <span className="mono text-[11px]">{localReactions[r.type] || 0}</span>
          </button>
        ))}
      </div>

      {/* ── Action Bar ── */}
      <div className="relative z-10 mt-4 flex items-center justify-between border-t border-border/30 px-5 py-2.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleVote(1)}
            className={cn(
              "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all",
              userVote === 1 ? "bg-emerald-500/10 text-emerald-400" : "text-muted-foreground hover:bg-secondary/60"
            )}
          >
            <ArrowUp className="h-3.5 w-3.5" />
            W
            <span className="mono ml-0.5">{localUpvotes}</span>
          </button>
          <button
            onClick={() => handleVote(-1)}
            className={cn(
              "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all",
              userVote === -1 ? "bg-red-500/10 text-red-400" : "text-muted-foreground hover:bg-secondary/60"
            )}
          >
            <ArrowDown className="h-3.5 w-3.5" />
            L
            <span className="mono ml-0.5">{localDownvotes}</span>
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleShareCard}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground"
          >
            <Share2 className="h-3.5 w-3.5" />
            Card
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground"
          >
            Share
          </button>
        </div>
      </div>
    </motion.article>

      {/* Share Card Modal */}
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
        }}
      />
    </>
  );
}
