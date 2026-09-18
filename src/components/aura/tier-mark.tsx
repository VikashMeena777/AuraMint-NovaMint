"use client";

import { cn } from "@/lib/utils";
import { TierMark as SharedTierMark } from "@/components/ui/tier-mark";
import { Chip } from "./primitives";
import { tierName } from "./mint";

/**
 * Thin adapter over the shared tier-mark system (`src/components/ui/tier-mark.tsx`,
 * shell-owned). One icon set and one `.hallmark` frame is used by the sidebar, the
 * landing ladder, the feed, the leaderboard, profiles and the duel — no second,
 * drift-prone tier→icon map lives in `components/aura`.
 *
 * If the shared component's API changes, only this file changes.
 */
export function TierMark({
  tier,
  size = "md",
  className,
}: {
  tier?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const mapped = size === "xl" ? "lg" : size;
  return <SharedTierMark tier={tierName(tier)} size={mapped} className={className} />;
}

/** Hallmark + tier name, for places that need both. */
export function TierPill({ tier, className }: { tier?: string | null; className?: string }) {
  const name = tierName(tier);
  return (
    <Chip tone="lead" className={cn("gap-2 py-1.5", className)}>
      <TierMark tier={name} size="sm" />
      <span className="normal-case tracking-normal">{name}</span>
    </Chip>
  );
}
