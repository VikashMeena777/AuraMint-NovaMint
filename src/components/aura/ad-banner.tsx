"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlanLimits } from "./hooks";
import { IconButton, Plate } from "./primitives";
import { TONE } from "./mint";

const DISMISS_KEY = "auramint:house-plate-dismissed-until";
const DISMISS_MS = 12 * 60 * 60 * 1000; // hide for 12h, not just for this remount

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}

function isDismissed(): boolean {
  try {
    const until = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

/**
 * House plate shown to free users only. Premium state comes from the real server flag
 * (prop, else `getUserPlanLimits`), never a default of `false`, so paying users are not
 * advertised to. Dismissal is persisted (external store) and the link is a client nav.
 */
export function AdBanner({ isPremium }: { isPremium?: boolean }) {
  const limits = usePlanLimits();
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => true);
  const premium = isPremium ?? limits.isPremium;

  if (premium || dismissed) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
    } catch {
      /* storage unavailable */
    }
    emit();
  }

  return (
    <Plate className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Sparkles className={cn("h-4 w-4 shrink-0", TONE.brassText)} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">Remove ads and mint without limits</p>
          <p className="truncate text-[11px] text-muted-foreground">
            Unlimited events, sharpest verdicts, no house plate.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/premium"
          className={cn(
            "rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em]",
            TONE.posBg
          )}
        >
          Upgrade
        </Link>
        <IconButton label="Dismiss upgrade banner" onClick={dismiss} className="h-7 w-7 border-transparent bg-transparent">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </IconButton>
      </div>
    </Plate>
  );
}
