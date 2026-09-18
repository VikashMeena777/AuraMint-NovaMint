"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  Flame,
  Gem,
  Gift,
  LayoutDashboard,
  LogOut,
  Medal,
  Search,
  Stamp,
  Trophy,
  User,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { AnimatedIcon } from "@/components/ui/animated-icon";
import { AuraNumber } from "@/components/ui/aura-number";
import { Button } from "@/components/ui/button";
import { TierMark } from "@/components/ui/tier-mark";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { OPEN_LOG_EVENT, OPEN_PALETTE_EVENT } from "@/components/layouts/events";

type ProfileData = {
  username: string;
  display_name: string;
  avatar_url: string;
  total_aura: number;
  current_tier: string;
  streak_days: number;
  is_premium: boolean;
} | null;

/**
 * Sidebar — the ledger spine.
 *
 * A solid ink plate with one brass hairline: no blur, no lift-on-hover, no
 * decorative loops. Nav rows are ledger lines with a 3px active rail; the aura
 * total is a struck figure with its tier hallmark, and every destination in the
 * product (including the previously orphaned analytics, badges and wrapped) is
 * reachable from a visible affordance.
 */
const navItems: { href: string; icon: LucideIcon; label: string }[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "The ledger" },
  { href: "/leaderboard", icon: Trophy, label: "Leaderboard" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/badges", icon: Medal, label: "Badges" },
  { href: "/wrapped", icon: Gift, label: "Wrapped" },
  { href: "/profile", icon: User, label: "Profile" },
  { href: "/premium", icon: Gem, label: "AuraMint+" },
];

export function Sidebar({ profile }: { profile: ProfileData }) {
  const pathname = usePathname();
  const router = useRouter();
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [signingOut, setSigningOut] = React.useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setSigningOut(false);
    toast.success("Signed out. Your ledger is safe.");
    router.push("/");
    router.refresh();
  }

  const displayName = profile?.display_name || profile?.username || "AuraMinter";

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col overflow-y-auto border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-5 lg:flex">
      {/* ── Wordmark ────────────────────────────────────────────────── */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 rounded-[var(--radius)] px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"
      >
        <Image
          src="/auramint-coin.svg"
          alt=""
          width={28}
          height={28}
          className="size-7"
          aria-hidden="true"
        />
        <span className="flex flex-col">
          <span className="heading text-[20px] leading-none text-[color-mix(in_srgb,var(--brass-500)_82%,hsl(var(--foreground)))]">
            AuraMint
          </span>
          <span className="label-micro mt-1 text-[10px]">Assay office</span>
        </span>
      </Link>

      {/* ── Struck balance widget ───────────────────────────────────── */}
      {profile ? (
        <section
          aria-label="Your balance"
          className="mt-5 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4"
        >
          <div className="flex items-center gap-2.5">
            <TierMark tier={profile.current_tier} size="sm" />
            <div className="min-w-0">
              <p className="label-micro">{profile.current_tier}</p>
              <p className="truncate text-[13px] font-semibold">{displayName}</p>
            </div>
          </div>

          <p className="label-micro mt-4">Total aura</p>
          <AuraNumber value={profile.total_aura} size="lg" className="mt-1" />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[hsl(var(--muted-foreground))]">
              <AnimatedIcon icon={Flame} idiom="press" className="size-3.5" />
              {profile.streak_days}-day streak
            </span>
            {profile.is_premium ? (
              <span className="label-micro label-brass rounded-[var(--radius-sm)] border border-[var(--brass-600)] px-1.5 py-0.5 text-[10px]">
                AuraMint+
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ── Primary action ──────────────────────────────────────────── */}
      <div className="mt-4 flex flex-col gap-2">
        <Button
          variant="strike"
          size="md"
          className="w-full"
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_LOG_EVENT))}
        >
          <AnimatedIcon icon={Stamp} idiom="press" className="size-4" />
          Log a moment
        </Button>
        <Button
          variant="plate"
          size="md"
          className="w-full justify-start text-[hsl(var(--muted-foreground))]"
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT))}
        >
          <AnimatedIcon icon={Search} idiom="press" className="size-4" />
          Search the ledger
          <span className="mono ml-auto hidden text-[11px] tracking-widest text-[hsl(var(--muted-foreground))] sm:inline">
            ⌘K
          </span>
        </Button>
      </div>

      <hr className="rule my-4" />

      {/* ── Nav ────────────────────────────────────────────────────── */}
      <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              onMouseEnter={() => setHovered(item.href)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(item.href)}
              onBlur={() => setHovered(null)}
              className={cn(
                "relative flex min-h-11 items-center gap-3 rounded-[var(--radius)] px-3 text-[14px] transition-colors",
                isActive
                  ? "bg-[hsl(var(--secondary))] font-semibold text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"
              )}
            >
              <AnimatedIcon
                icon={item.icon}
                idiom="nudge"
                active={isActive}
                hovered={hovered === item.href}
                className="size-4"
              />
              <span>{item.label}</span>
              {item.href === "/premium" && !profile?.is_premium ? (
                <span className="label-micro label-brass ml-auto text-[10px]">
                  Plus
                </span>
              ) : null}
              {isActive ? (
                <motion.span
                  aria-hidden="true"
                  layoutId="sidebar-active-rail"
                  className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-[var(--patina-400)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer actions ─────────────────────────────────────────── */}
      <hr className="rule my-4" />
      <div className="flex items-center gap-2">
        <ThemeToggle withLabel className="flex-1 justify-center" />
        <Button
          variant="quiet"
          size="md"
          className="flex-1 justify-center text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)] hover:text-[hsl(var(--destructive))]"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          <AnimatedIcon icon={LogOut} idiom="slide" className="size-4" />
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </div>

      {profile ? (
        <p className="mono mt-3 truncate px-1 text-[11px] text-[hsl(var(--muted-foreground))]">
          @{profile.username || "you"}
        </p>
      ) : null}
    </aside>
  );
}
