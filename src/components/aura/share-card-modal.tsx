"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Share2 } from "lucide-react";
import { cn, formatAuraPoints } from "@/lib/utils";
import { toast } from "sonner";
import { PremiumIcon } from "@/components/aura/premium-icon";
import { QRCodeSVG } from "qrcode.react";

type ShareCardData = {
  description: string;
  aura_points: number;
  ai_verdict: string;
  ai_emoji: string;
  ai_vibe_tag: string;
  username: string;
  tier: string;
  event_id?: string;
  isPremium?: boolean;
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
      toast.success("Card saved to device! 📸");
    } catch {
      toast.error("Couldn't generate card image. Try screenshotting instead.");
    }
    setDownloading(false);
  }

  async function handleShare() {
    const text = `${data.ai_emoji} ${formatAuraPoints(data.aura_points)} aura\n\n"${data.description}"\n\n${data.ai_verdict}\n\n— @${data.username} on AuraMint 👑`;
    if (navigator.share) {
      try { await navigator.share({ text }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Copied share text to clipboard! 📋");
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-sm relative"
          >
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute -right-2 -top-12 rounded-xl bg-black/40 border border-white/10 p-2.5 text-white hover:bg-black/60 transition z-50"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            {/* Redesigned Premium Holographic Viral Card */}
            <div
              ref={cardRef}
              className={cn(
                "relative overflow-hidden rounded-[2.25rem] p-7 shadow-2xl border",
                data.isPremium && "ring-2 ring-yellow-400/30",
                isPositive
                  ? data.isPremium
                    ? "bg-gradient-to-br from-emerald-950 via-teal-900 to-emerald-800 border-emerald-400/30"
                    : "bg-gradient-to-br from-emerald-950 via-teal-950 to-emerald-900 border-emerald-500/20"
                  : data.isPremium
                    ? "bg-gradient-to-br from-red-950 via-rose-900 to-red-800 border-red-400/30"
                    : "bg-gradient-to-br from-red-950 via-rose-950 to-red-900 border-red-500/20"
              )}
            >
              {/* Noise texture */}
              <div
                className="absolute inset-0 opacity-[0.08] pointer-events-none"
                style={{
                  backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")"
                }}
              />

              {/* holographic light leak overlays */}
              <div className={cn(
                "absolute -right-20 -top-20 h-48 w-48 rounded-full blur-3xl opacity-40 pointer-events-none",
                isPositive ? "bg-emerald-400" : "bg-red-400"
              )} />
              <div className="absolute -left-20 -bottom-20 h-48 w-48 rounded-full bg-white/5 blur-3xl pointer-events-none" />

              {/* Premium holographic shimmer */}
              {data.isPremium && (
                <div
                  className="absolute inset-0 pointer-events-none opacity-10"
                  style={{
                    background: "linear-gradient(135deg, transparent 30%, rgba(255,215,0,0.3) 50%, transparent 70%)",
                    backgroundSize: "200% 200%",
                    animation: "shimmer 3s ease-in-out infinite",
                  }}
                />
              )}

              <div className="relative z-10 flex flex-col justify-between min-h-[340px]">
                {/* Header User info */}
                <div>
                  <div className="flex items-center justify-between text-white/50">
                    <span className="text-xs font-bold uppercase tracking-wider">@{data.username}</span>
                    <div className="flex items-center gap-2">
                      {data.isPremium && (
                        <span className="text-[9px] font-black uppercase tracking-widest bg-gradient-to-r from-yellow-400/20 to-amber-400/20 border border-yellow-400/30 px-2 py-0.5 rounded-full text-yellow-300">
                          ✦ Premium
                        </span>
                      )}
                      <span className="text-[10px] font-extrabold uppercase tracking-widest bg-white/10 px-2.5 py-0.5 rounded-full text-white/70">
                        {data.tier}
                      </span>
                    </div>
                  </div>

                  {/* Quoted Moment Description */}
                  <p className="mt-5 text-[15px] font-bold leading-relaxed text-white/95">
                    &ldquo;{data.description}&rdquo;
                  </p>
                </div>

                {/* Score panel display */}
                <div className="mt-6">
                  <div className="flex items-baseline gap-3">
                    <span
                      className={cn(
                        "heading text-[48px] font-black tracking-tight leading-none text-white",
                        isPositive ? "text-emerald-400" : "text-red-400"
                      )}
                      style={{ fontFamily: "var(--font-display)", textShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
                    >
                      {isPositive ? "+" : ""}
                      {formatAuraPoints(data.aura_points)}
                    </span>
                    <PremiumIcon emoji={data.ai_emoji} className="h-9 w-9 animate-bounce" />
                  </div>

                  {/* SAVAGE VERDICT */}
                  <p className="mt-3.5 text-xs italic leading-relaxed text-white/60 border-l border-white/20 pl-3">
                    {data.ai_verdict}
                  </p>

                  {/* Custom vibe flag */}
                  {data.ai_vibe_tag && (
                    <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-white/10 px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-white/80 border border-white/5 shadow-inner">
                      <PremiumIcon emoji="✨" className="h-3 w-3 text-yellow-300" />
                      <span>{data.ai_vibe_tag}</span>
                    </span>
                  )}
                </div>

                {/* Watermark + QR Code alignment */}
                <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-4">
                  <div>
                    <span className="text-[9px] font-extrabold tracking-widest text-white/30 block">
                      AURAMINT.NOVAMINTNETWORKS.IN
                    </span>
                    <span className="text-[8px] font-bold text-white/25 uppercase flex items-center gap-1 mt-0.5">
                      <span>Check your aura status</span>
                      <PremiumIcon emoji="👑" className="h-2.5 w-2.5" />
                    </span>
                  </div>
                  <div className="rounded-xl bg-white/5 p-1 border border-white/10 shadow-md">
                    <QRCodeSVG
                      value={data.event_id ? `https://auramint.novamintnetworks.in/event/${data.event_id}` : "https://auramint.novamintnetworks.in"}
                      size={36}
                      bgColor="transparent"
                      fgColor="rgba(255,255,255,0.7)"
                      level="L"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white py-4 text-xs font-bold uppercase tracking-wider text-black transition hover:bg-white/90 active:scale-98 disabled:opacity-50 shadow-lg"
              >
                <Download className="h-4 w-4" />
                <span>{downloading ? "Generating..." : "Save Card"}</span>
              </button>
              <button
                onClick={handleShare}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-black/40 backdrop-blur-md py-4 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10 active:scale-98"
              >
                <Share2 className="h-4 w-4" />
                <span>Share</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
