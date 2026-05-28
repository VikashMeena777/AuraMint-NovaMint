"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Trophy, Sparkles, User, Medal } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Feed" },
  { href: "/leaderboard", icon: Trophy, label: "Board" },
  { href: "#submit", icon: Sparkles, label: "Log", isAction: true },
  { href: "/badges", icon: Medal, label: "Badges" },
  { href: "/profile", icon: User, label: "Me" },
];

export function BottomNav() {
  const pathname = usePathname();

  function handleSubmitClick() {
    window.dispatchEvent(new CustomEvent("open-submit-modal"));
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 lg:hidden pointer-events-none">
      <nav className="mx-auto max-w-md pointer-events-auto rounded-3xl border border-border/40 bg-card/75 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-around px-2 py-1.5">
          {items.map((item, idx) => {
            if (item.isAction) {
              return (
                <button
                  key="submit"
                  onClick={handleSubmitClick}
                  className="relative -top-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-105 active:scale-95 glow-brand border border-primary/20"
                >
                  {/* Subtle pulsing background ring around primary action button */}
                  <div className="absolute inset-0 rounded-2xl bg-primary/20 animate-ping opacity-60" />
                  <item.icon className="relative z-10 h-6 w-6" />
                </button>
              );
            }

            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href || idx}
                href={item.href}
                className="flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all active:scale-95"
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 transition-transform",
                    isActive ? "text-primary scale-110" : "text-muted-foreground hover:text-foreground"
                  )}
                />
                <span
                  className={cn(
                    "text-[9px] font-extrabold uppercase tracking-wider",
                    isActive ? "text-primary" : "text-muted-foreground/60"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
