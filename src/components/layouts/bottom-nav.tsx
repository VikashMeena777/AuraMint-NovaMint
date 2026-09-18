"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
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
import { useSession } from "@/components/providers/session-provider";
import { AnimatedIcon } from "@/components/ui/animated-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogSheetContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { OPEN_LOG_EVENT, OPEN_PALETTE_EVENT } from "@/components/layouts/events";

/**
 * BottomNav — the phone shell.
 *
 * Five slots: Feed · Ranks · LOG · Wrapped · You. The Log action broadcasts
 * `open-submit-modal`, which the single global log sheet in
 * `src/app/(app)/layout.tsx` answers on EVERY route (previously the mobile
 * centre button was dead outside the feed).
 *
 * "You" opens a real dialog sheet holding the destinations and account actions
 * that used to be unreachable on a phone: analytics, badges, wrapped, premium,
 * theme and sign-out.
 */
const leadingTabs: { href: string; icon: LucideIcon; label: string }[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Feed" },
  { href: "/leaderboard", icon: Trophy, label: "Ranks" },
];

const trailingTab: { href: string; icon: LucideIcon; label: string } = {
  href: "/wrapped",
  icon: Gift,
  label: "Wrapped",
};

const sheetLinks: { href: string; icon: LucideIcon; label: string; hint: string }[] = [
  { href: "/profile", icon: User, label: "Profile", hint: "Your stats, chart and history" },
  { href: "/analytics", icon: BarChart3, label: "Analytics", hint: "Category and vibe breakdown" },
  { href: "/badges", icon: Medal, label: "Badges", hint: "Earned and locked hallmarks" },
  { href: "/wrapped", icon: Gift, label: "Wrapped", hint: "Your monthly banknote recap" },
  { href: "/premium", icon: Gem, label: "AuraMint+", hint: "Pricing and plan management" },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { email } = useSession();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setSigningOut(false);
    setMenuOpen(false);
    toast.success("Signed out. Your ledger is safe.");
    router.push("/");
    router.refresh();
  }

  function openLogSheet() {
    window.dispatchEvent(new CustomEvent(OPEN_LOG_EVENT));
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] pb-[env(safe-area-inset-bottom)] lg:hidden">
      <nav aria-label="Primary" className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {leadingTabs.map((tab) => (
          <NavSlot key={tab.href} {...tab} active={isActive(tab.href)} />
        ))}

        <div className="flex items-center px-1">
          <button
            type="button"
            onClick={openLogSheet}
            aria-label="Log an aura moment"
            className="flex size-12 -translate-y-3 items-center justify-center rounded-[var(--radius)] border border-[var(--patina-700)] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm transition-transform active:scale-95 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"
          >
            <AnimatedIcon icon={Stamp} idiom="press" className="size-5" strokeWidth={1.75} />
          </button>
        </div>

        <NavSlot
          href={trailingTab.href}
          icon={trailingTab.icon}
          label={trailingTab.label}
          active={isActive(trailingTab.href)}
        />

        <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-expanded={menuOpen}
              className={cn(
                "flex min-h-14 min-w-14 flex-col items-center justify-center gap-1 rounded-[var(--radius)] px-2 text-[11px] font-semibold transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[hsl(var(--ring))]",
                menuOpen ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"
              )}
            >
              <AnimatedIcon icon={User} idiom="nudge" active={menuOpen} className="size-5" />
              You
            </button>
          </DialogTrigger>

          <DialogSheetContent>
            <DialogTitle className="pr-8 text-[20px]">You</DialogTitle>
            <p className="mono mt-1 truncate text-[11px] text-[hsl(var(--muted-foreground))]">
              {email ?? "Signed in"}
            </p>

            <hr className="rule my-4" />

            <nav aria-label="Account" className="flex flex-col">
              {sheetLinks.map(({ href, icon: Icon, label, hint }) => (
                <DialogClose asChild key={href}>
                  <Link
                    href={href}
                    className="flex min-h-14 items-center gap-3 border-b border-[hsl(var(--border))] py-2 text-[14px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[hsl(var(--ring))]"
                  >
                    <AnimatedIcon
                      icon={Icon}
                      idiom="slide"
                      className="size-4 text-[hsl(var(--muted-foreground))]"
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold">{label}</span>
                      <span className="truncate text-[12px] text-[hsl(var(--muted-foreground))]">
                        {hint}
                      </span>
                    </span>
                  </Link>
                </DialogClose>
              ))}
            </nav>

            <div className="mt-4 flex flex-col gap-2">
              <DialogClose asChild>
                <Button
                  variant="plate"
                  size="md"
                  className="w-full justify-start"
                  onClick={() => window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT))}
                >
                  <Search className="size-4" aria-hidden="true" />
                  Search the ledger
                </Button>
              </DialogClose>

              <div className="flex items-center gap-2">
                <ThemeToggle withLabel className="flex-1 justify-center" />
                <Button
                  variant="quiet"
                  size="md"
                  className="flex-1 justify-center text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)] hover:text-[hsl(var(--destructive))]"
                  onClick={handleSignOut}
                  disabled={signingOut}
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  {signingOut ? "Signing out…" : "Sign out"}
                </Button>
              </div>
            </div>
          </DialogSheetContent>
        </Dialog>
      </nav>
    </div>
  );
}

function NavSlot({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-14 min-w-14 flex-col items-center justify-center gap-1 rounded-[var(--radius)] px-2 text-[11px] font-semibold transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[hsl(var(--ring))]",
        active ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"
      )}
    >
      <AnimatedIcon icon={icon} idiom="nudge" active={active} className="size-5" />
      {label}
    </Link>
  );
}
