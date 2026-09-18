"use client";

import { iconForMark, type MarkName } from "@/components/icons/registry";
import { AnimatedIcon, type AnimatedIconProps } from "@/components/ui/animated-icon";

/**
 * MintIcon — the same animated icon, named instead of imported.
 *
 * A Server Component cannot pass a component reference across the server →
 * client boundary, which is why the landing page's server-rendered sections used
 * to draw plain static Lucide glyphs. They can pass a *string*, so this thin
 * client wrapper resolves the name against the mark registry and renders the
 * fully animated icon without shipping the whole registry to the server.
 */
export type MintIconProps = Omit<AnimatedIconProps, "icon"> & { name: MarkName };

export function MintIcon({ name, ...props }: MintIconProps) {
  return <AnimatedIcon icon={iconForMark(name)} {...props} />;
}
