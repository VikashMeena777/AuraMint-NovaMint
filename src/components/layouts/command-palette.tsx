"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Gem,
  Gift,
  LayoutDashboard,
  LogOut,
  Medal,
  Moon,
  Stamp,
  Sun,
  Trophy,
  User,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { OPEN_LOG_EVENT, OPEN_PALETTE_EVENT } from "@/components/layouts/events";

/**
 * CommandPalette — the ⌘/Ctrl-K surface, rebuilt as a real dialog.
 *
 * Accessibility: cmdk owns the combobox semantics, arrow-key navigation,
 * filtering and `aria-activedescendant`; our Dialog primitives own Escape,
 * scroll lock, focus trapping and focus return. The palette is also reachable
 * by TAP (the sidebar and the mobile sheet broadcast `auramint:open-palette`),
 * so it is no longer a keyboard-only feature.
 */
const destinations = [
  { id: "feed", label: "The ledger (feed)", hint: "Today's entries and the daily strip", href: "/dashboard", icon: LayoutDashboard },
  { id: "leaderboard", label: "Leaderboard", hint: "Ranked ledger across all minters", href: "/leaderboard", icon: Trophy },
  { id: "analytics", label: "Analytics", hint: "Assay report for the last 30 days", href: "/analytics", icon: BarChart3 },
  { id: "badges", label: "Badges", hint: "Earned and locked hallmarks", href: "/badges", icon: Medal },
  { id: "wrapped", label: "Wrapped", hint: "Your monthly banknote recap", href: "/wrapped", icon: Gift },
  { id: "profile", label: "Profile", hint: "Stats, chart and history", href: "/profile", icon: User },
  { id: "premium", label: "AuraMint+", hint: "Unlimited minting, ₹99 a month", href: "/premium", icon: Gem },
] as const;

export function CommandPalette() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const setOpenAndReset = React.useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
  }, []);

  // ⌘/Ctrl-K anywhere, plus the tap affordances in the shell.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
    }
    function onOpenRequest() {
      setOpen(true);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpenRequest);
    };
  }, []);

  function go(href: string) {
    setOpenAndReset(false);
    router.push(href);
    router.refresh();
  }

  function logMoment() {
    setOpenAndReset(false);
    // The global log sheet is mounted once in (app)/layout.tsx on every route.
    window.dispatchEvent(new CustomEvent(OPEN_LOG_EVENT));
  }

  function toggleTheme() {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
    toast.success(`Switched to ${next} mode`);
    setOpenAndReset(false);
  }

  async function signOut() {
    const supabase = createClient();
    setOpenAndReset(false);
    await supabase.auth.signOut();
    toast.success("Signed out. Your ledger is safe.");
    router.push("/");
    router.refresh();
  }

  const isDark = resolvedTheme === "dark";

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpenAndReset}
      title="Command palette"
      description="Jump to a surface, log a moment, or change the theme."
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Where to? Try “wrapped”, “log”, “theme”…"
        aria-label="Search commands"
      />
      <CommandList>
        <CommandEmpty>No match. Try “feed”, “premium” or “sign out”.</CommandEmpty>

        <CommandGroup heading="Go to">
          {destinations.map(({ id, label, hint, href, icon: Icon }) => (
            <CommandItem
              key={id}
              value={`${label} ${hint} ${id}`}
              onSelect={() => go(href)}
            >
              <Icon className="size-4 shrink-0 text-[hsl(var(--muted-foreground))]" aria-hidden="true" strokeWidth={1.75} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{label}</span>
                <span className="truncate text-[12px] text-[hsl(var(--muted-foreground))]">{hint}</span>
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem value="log moment strike verdict mint" onSelect={logMoment}>
            <Stamp className="size-4 shrink-0 text-[hsl(var(--muted-foreground))]" aria-hidden="true" strokeWidth={1.75} />
            <span>Log a moment</span>
            <CommandShortcut>Enter</CommandShortcut>
          </CommandItem>
          <CommandItem value="theme dark light toggle appearance" onSelect={toggleTheme}>
            {isDark ? (
              <Sun className="size-4 shrink-0 text-[hsl(var(--muted-foreground))]" aria-hidden="true" strokeWidth={1.75} />
            ) : (
              <Moon className="size-4 shrink-0 text-[hsl(var(--muted-foreground))]" aria-hidden="true" strokeWidth={1.75} />
            )}
            <span>Switch to {isDark ? "light" : "dark"} mode</span>
          </CommandItem>
          <CommandItem value="sign out logout exit account" onSelect={signOut}>
            <LogOut className="size-4 shrink-0 text-[hsl(var(--destructive))]" aria-hidden="true" strokeWidth={1.75} />
            <span>Sign out</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
