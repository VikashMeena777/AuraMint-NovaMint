"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Trophy, Sparkles, User, Crown, Medal } from "lucide-react";
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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/40 bg-card/70 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around py-1.5">
        {items.map((item) => {
          if (item.isAction) {
            return (
              <button
                key="submit"
                onClick={handleSubmitClick}
                className="flex flex-col items-center"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg glow-brand">
                  <item.icon className="h-5 w-5" />
                </div>
              </button>
            );
          }

          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 py-1.5"
            >
              <item.icon
                className={cn(
                  "h-[20px] w-[20px] transition",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
