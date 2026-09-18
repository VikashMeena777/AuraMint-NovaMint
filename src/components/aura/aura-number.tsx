"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { AuraNumber as SharedAuraNumber } from "@/components/ui/aura-number";

export type AuraNumberSize = "sm" | "md" | "lg" | "xl" | "hero";

const SIZE_MAP: Record<AuraNumberSize, "sm" | "md" | "lg" | "display"> = {
  sm: "sm",
  md: "md",
  lg: "lg",
  xl: "display",
  hero: "display",
};

/**
 * Thin adapter over the shared number renderer (`src/components/ui/aura-number.tsx`,
 * shell-owned) so the whole product — landing, sidebar, ledger, profile, wrapped, share
 * plate — formats an aura figure identically (en-IN grouping, one sign rule, one palette).
 *
 * The adapter only adds the reveal "Roll": the shared renderer animates on *change*, so a
 * value that is born in a modal is seeded at 0 for one frame and then rolls up to the real
 * figure. Under reduced motion the final value is shown immediately.
 */
export function AuraNumber({
  value,
  size = "md",
  className,
  colorClassName,
  signed = true,
  animate = false,
}: {
  value: number | null | undefined;
  size?: AuraNumberSize;
  className?: string;
  /** Override the polarity colour (e.g. on a fixed-ink share plate). */
  colorClassName?: string;
  /** `true` = ledger delta (`+1,250`); `false` = balance (`1,250`). */
  signed?: boolean;
  animate?: boolean;
}) {
  const safe = Number.isFinite(value) ? (value as number) : 0;
  const reducedMotion = useReducedMotion();
  const [settled, setSettled] = useState(!animate);

  useEffect(() => {
    if (!animate) return;
    const frame = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(frame);
  }, [animate]);

  const resolved = !animate || settled || reducedMotion ? safe : 0;

  return (
    <SharedAuraNumber
      value={resolved}
      signed={signed}
      size={SIZE_MAP[size]}
      className={cn(className, colorClassName)}
    />
  );
}
