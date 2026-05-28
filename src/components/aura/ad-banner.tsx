"use client";

import { X } from "lucide-react";
import { useState } from "react";

/**
 * Ad banner shown to free users. Hidden for premium.
 * In production, integrate with Google AdSense or similar.
 * For now, shows a self-promotion banner.
 */
export function AdBanner({ isPremium = false }: { isPremium?: boolean }) {
  const [dismissed, setDismissed] = useState(false);

  if (isPremium || dismissed) return null;

  return (
    <div className="glass noise relative overflow-hidden">
      <div className="relative z-10 flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-lg">✨</span>
          <div>
            <p className="text-[12px] font-semibold">
              Go Premium for ad-free experience
            </p>
            <p className="text-[11px] text-muted-foreground">
              Unlimited events, extra savage AI verdicts, exclusive themes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/premium"
            className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground transition hover:brightness-110"
          >
            Upgrade
          </a>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-lg p-1 text-muted-foreground transition hover:bg-secondary/60"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
