"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Share2 } from "lucide-react";
import { cn, formatAuraPoints } from "@/lib/utils";
import { toast } from "sonner";

type ShareCardData = {
  description: string;
  aura_points: number;
  ai_verdict: string;
  ai_emoji: string;
  ai_vibe_tag: string;
  username: string;
  tier: string;
};

export function ShareCardModal({
  data,
  isOpen,
  onClose,
}: {
  data: ShareCardData;
  isOpen: boolean;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const isPositive = data.aura_points >= 0;

  async function handleDownload() {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `auramint-${data.aura_points > 0 ? "W" : "L"}-${Date.now()}.png`;
      a.click();
      toast.success("Card saved! 📸");
    } catch {
      toast.error("Couldn't generate image. Try screenshotting instead.");
    }
    setDownloading(false);
  }

  async function handleShare() {
    const text = `${data.ai_emoji} ${formatAuraPoints(data.aura_points)} aura\n\n"${data.description}"\n\n${data.ai_verdict}\n\n— @${data.username} on AuraMint 👑`;
    if (navigator.share) {
      try { await navigator.share({ text }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard! 📋");
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-sm"
          >
            {/* Close */}
            <button onClick={onClose} className="absolute right-4 top-4 rounded-full bg-black/40 p-2 text-white">
              <X className="h-5 w-5" />
            </button>

            {/* The Card */}
            <div
              ref={cardRef}
              className={cn(
                "relative overflow-hidden rounded-3xl p-6",
                isPositive
                  ? "bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950"
                  : "bg-gradient-to-br from-red-950 via-red-900 to-red-950"
              )}
            >
              {/* Noise overlay */}
              <div className="absolute inset-0 opacity-[0.06]" style={{
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")"
              }} />

              {/* Glow ring */}
              <div className={cn(
                "absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl",
                isPositive ? "bg-emerald-500/20" : "bg-red-500/20"
              )} />

              <div className="relative z-10">
                {/* Header */}
                <div className="flex items-center gap-2 text-white/60">
                  <span className="text-sm font-medium">@{data.username}</span>
                  <span className="text-xs">·</span>
                  <span className="text-xs">{data.tier}</span>
                </div>

                {/* Description */}
                <p className="mt-4 text-[15px] leading-relaxed text-white/90">
                  &ldquo;{data.description}&rdquo;
                </p>

                {/* Points */}
                <div className="mt-5 flex items-baseline gap-3">
                  <span className={cn(
                    "text-[42px] font-black tracking-tighter leading-none",
                    isPositive ? "text-emerald-400" : "text-red-400"
                  )} style={{ fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                    {formatAuraPoints(data.aura_points)}
                  </span>
                  <span className="text-3xl">{data.ai_emoji}</span>
                </div>

                {/* Verdict */}
                <p className="mt-3 text-[13px] italic text-white/50">
                  {data.ai_verdict}
                </p>

                {/* Vibe Tag */}
                {data.ai_vibe_tag && (
                  <span className="mt-3 inline-block rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/70">
                    ✨ {data.ai_vibe_tag}
                  </span>
                )}

                {/* Watermark */}
                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-3">
                  <span className="text-[11px] font-bold tracking-wider text-white/30">
                    AURAMINT.NOVAMINTNETWORKS.IN
                  </span>
                  <span className="text-lg">👑</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {downloading ? "Saving..." : "Save Image"}
              </button>
              <button
                onClick={handleShare}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/20 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
