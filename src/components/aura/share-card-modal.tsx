"use client";

import { useRef, useState } from "react";
import { Download, Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { MINT, appHost, eventShareUrl, formatSignedAura, seedFrom, tierName } from "./mint";
import { AuraNumber } from "./aura-number";
import { EmojiMark } from "./primitives";
import { TierMark } from "./tier-mark";
import { MintDialog } from "./mint-dialog";

export type ShareCardData = {
  description: string;
  aura_points: number;
  ai_verdict?: string | null;
  ai_emoji?: string | null;
  ai_vibe_tag?: string | null;
  username: string;
  tier: string;
  event_id?: string;
  /** True premium status of the subject (never inferred from ownership). */
  isPremium?: boolean;
};

/** Deterministic mint serial, e.g. `No. 4F2A19`. */
function serialFor(seed: string): string {
  return `No. ${seedFrom(seed).toString(16).toUpperCase().padStart(6, "0").slice(0, 6)}`;
}

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
  const [sharing, setSharing] = useState(false);

  const isPositive = data.aura_points >= 0;
  const serial = serialFor(data.event_id || `${data.username}:${data.aura_points}:${data.description}`);
  const tier = tierName(data.tier);

  async function renderPng(): Promise<string | null> {
    if (!cardRef.current) return null;
    const { toPng } = await import("html-to-image");
    // Wait for webfonts so the serif denomination is not captured as a fallback face.
    try {
      await document.fonts?.ready;
    } catch {
      /* fonts API unavailable */
    }
    return toPng(cardRef.current, {
      pixelRatio: 3,
      cacheBust: true,
      backgroundColor: "#0B0E0C",
    });
  }

  async function handleDownload() {
    if (downloading || sharing) return;
    setDownloading(true);
    try {
      const url = await renderPng();
      if (!url) throw new Error("no node");
      const a = document.createElement("a");
      a.href = url;
      a.download = `auramint-${data.aura_points >= 0 ? "W" : "L"}-${serial.replace(/[^A-Z0-9]/gi, "")}.png`;
      a.click();
      toast.success("Card saved to device.");
    } catch {
      toast.error("Couldn't generate the card image — take a screenshot instead.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleShare() {
    if (sharing || downloading) return;
    setSharing(true);
    const shareUrl = data.event_id ? eventShareUrl(data.event_id) : windowOrigin();
    const text = `${data.ai_emoji ?? ""} ${formatSignedAura(data.aura_points)} aura\n\n"${data.description}"\n\n${data.ai_verdict ?? ""}\n\n— @${data.username} on AuraMint`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ text, url: shareUrl });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
        toast.success("Copied share text to clipboard.");
      } else {
        throw new Error("no share target");
      }
    } catch (err) {
      // A user cancelling the native sheet is not an error worth shouting about.
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        toast.error("Couldn't share automatically — copy the text manually.");
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <MintDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Minted note"
      description="Save or share the card. The QR resolves to the public event record."
      className="bg-[#12160F] border-[#2A3226] sm:max-w-md"
      titleClassName="text-[#EDEAE2]"
    >
      {/* Captured node: fully tokenised inline palette so nothing depends on oklch utilities. */}
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-2xl border p-6"
        style={{ background: "#0B0E0C", borderColor: "#2A3226", color: "#EDEAE2" }}
      >
        {/* guilloche band */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, ${MINT.brass} 0 1px, transparent 1px 9px)`,
          }}
        />
        <div className="relative z-10 flex flex-col justify-between gap-6">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "#9BA1A9" }}>
              @{data.username}
            </span>
            <span
              className="rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ borderColor: `${MINT.brass}66`, color: MINT.brass }}
            >
              {data.isPremium ? "✦ Premium" : "Standard"}
            </span>
          </div>

          <div>
            <p className="text-[15px] font-medium leading-relaxed" style={{ color: "#EDEAE2" }}>
              &ldquo;{data.description}&rdquo;
            </p>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#9BA1A9" }}>
                Denomination
              </span>
              <div className="mt-1">
                <AuraNumber
                  value={data.aura_points}
                  size="hero"
                  colorClassName={isPositive ? "text-[#3FB68C]" : "text-[#E0795F]"}
                />
              </div>
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "#9BA1A9" }}>
                aura · {serial}
              </span>
            </div>
            <span className="flex items-center gap-3">
              <EmojiMark emoji={data.ai_emoji} className="text-3xl" label="aura verdict emoji" />
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full border"
                style={{ borderColor: `${MINT.brass}88` }}
              >
                <TierMark tier={tier} size="md" />
              </span>
            </span>
          </div>

          {data.ai_verdict ? (
            <p className="border-l pl-3 text-xs italic leading-relaxed" style={{ borderColor: "#3A4436", color: "#B9BDC2" }}>
              {data.ai_verdict}
            </p>
          ) : null}

          <div className="flex items-end justify-between gap-4 border-t pt-4" style={{ borderColor: "#2A3226" }}>
            <div>
              {data.ai_vibe_tag ? (
                <span
                  className="inline-block rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  style={{ borderColor: "#3A4436", color: "#CDE7DC" }}
                >
                  {data.ai_vibe_tag}
                </span>
              ) : null}
              <span className="mt-2 block text-[10px] font-semibold tracking-[0.12em]" style={{ color: "#6B7078" }}>
                {appHost()}/event
              </span>
              <span className="block text-[10px]" style={{ color: "#6B7078" }}>
                Get your aura minted.
              </span>
            </div>
            <span className="rounded-lg border p-1.5" style={{ borderColor: `${MINT.brass}55` }}>
              <QRCodeSVG
                value={data.event_id ? eventShareUrl(data.event_id) : windowOrigin()}
                size={40}
                bgColor="transparent"
                fgColor="#C9C6BC"
                level="L"
              />
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading || sharing}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] transition-colors disabled:opacity-50"
          style={{ background: MINT.brass, color: "#0B0E0C" }}
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
          {downloading ? "Generating" : "Save card"}
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={downloading || sharing}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] transition-colors disabled:opacity-50"
          style={{ borderColor: "#3A4436", color: "#EDEAE2" }}
        >
          {sharing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
          Share
        </button>
      </div>

      <p className="mt-3 text-center text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        Exported at 3× with sRGB colours · {formatSignedAura(data.aura_points)} aura
      </p>
    </MintDialog>
  );
}

function windowOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL || "https://auramint.novamintnetworks.in";
}
