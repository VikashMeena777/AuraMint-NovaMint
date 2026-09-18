"use client";

import {
  ArrowRight,
  BadgeCheck,
  Ban,
  BarChart3,
  BookOpenText,
  Crown,
  Eye,
  Flame,
  Gauge,
  Gem,
  Ghost,
  Gift,
  Landmark,
  Layers,
  LayoutDashboard,
  LogOut,
  Medal,
  Menu,
  Moon,
  MoveRight,
  Palette,
  PenLine,
  Rocket,
  RotateCcw,
  Search,
  ShieldCheck,
  Skull,
  Sparkles,
  Stamp,
  Star,
  Sun,
  Trophy,
  User,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { MARKS, type IconMark, type MarkName } from "@/components/icons/marks";

/**
 * Mark registry — the join between a Lucide glyph (what call sites already pass)
 * and its animated, part-based counterpart.
 *
 * Two lookups exist because icons cross the server/client boundary in two
 * different shapes:
 * - client code passes the imported component (`<AnimatedIcon icon={Stamp} />`),
 *   so the registry is keyed by component identity;
 * - a Server Component cannot pass a component reference across the boundary at
 *   all, so it names the mark as a string and `MintIcon` resolves it here.
 */

type MarkEntry = { Icon: LucideIcon; mark: IconMark };

const ENTRIES: Record<MarkName, MarkEntry> = {
  stamp: { Icon: Stamp, mark: MARKS.stamp },
  sparkles: { Icon: Sparkles, mark: MARKS.sparkles },
  zap: { Icon: Zap, mark: MARKS.zap },
  search: { Icon: Search, mark: MARKS.search },
  menu: { Icon: Menu, mark: MARKS.menu },
  sun: { Icon: Sun, mark: MARKS.sun },
  moon: { Icon: Moon, mark: MARKS.moon },
  crown: { Icon: Crown, mark: MARKS.crown },
  flame: { Icon: Flame, mark: MARKS.flame },
  trophy: { Icon: Trophy, mark: MARKS.trophy },
  gauge: { Icon: Gauge, mark: MARKS.gauge },
  "pen-line": { Icon: PenLine, mark: MARKS["pen-line"] },
  "book-open-text": { Icon: BookOpenText, mark: MARKS["book-open-text"] },
  "rotate-ccw": { Icon: RotateCcw, mark: MARKS["rotate-ccw"] },
  "move-right": { Icon: MoveRight, mark: MARKS["move-right"] },
  "arrow-right": { Icon: ArrowRight, mark: MARKS["arrow-right"] },
  eye: { Icon: Eye, mark: MARKS.eye },
  landmark: { Icon: Landmark, mark: MARKS.landmark },
  layers: { Icon: Layers, mark: MARKS.layers },
  "badge-check": { Icon: BadgeCheck, mark: MARKS["badge-check"] },
  "shield-check": { Icon: ShieldCheck, mark: MARKS["shield-check"] },
  rocket: { Icon: Rocket, mark: MARKS.rocket },
  palette: { Icon: Palette, mark: MARKS.palette },
  ban: { Icon: Ban, mark: MARKS.ban },
  "bar-chart": { Icon: BarChart3, mark: MARKS["bar-chart"] },
  skull: { Icon: Skull, mark: MARKS.skull },
  ghost: { Icon: Ghost, mark: MARKS.ghost },
  user: { Icon: User, mark: MARKS.user },
  star: { Icon: Star, mark: MARKS.star },
  "layout-dashboard": { Icon: LayoutDashboard, mark: MARKS["layout-dashboard"] },
  medal: { Icon: Medal, mark: MARKS.medal },
  gift: { Icon: Gift, mark: MARKS.gift },
  gem: { Icon: Gem, mark: MARKS.gem },
  "log-out": { Icon: LogOut, mark: MARKS["log-out"] },
};

const byIcon = new Map<LucideIcon, IconMark>(
  Object.values(ENTRIES).map((entry) => [entry.Icon, entry.mark])
);

/** The animated parts for a Lucide glyph, or `undefined` (use the plain idiom). */
function markForIcon(icon: LucideIcon): IconMark | undefined {
  return byIcon.get(icon);
}

/** The Lucide glyph a mark name stands for. */
function iconForMark(name: MarkName): LucideIcon {
  return ENTRIES[name].Icon;
}

export { markForIcon, iconForMark, type MarkName };
