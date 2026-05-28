"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crown, LayoutDashboard, Trophy, User, Gem, Flame, Moon, Sun, LogOut, Settings, Sparkles, Medal } from "lucide-react";
import { useTheme } from "next-themes";
import { cn, formatAuraPoints } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type ProfileData = {
  username: string;
  display_name: string;
  avatar_url: string;
  total_aura: number;
  current_tier: string;
  streak_days: number;
  is_premium: boolean;
} | null;

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Feed" },
  { href: "/leaderboard", icon: Trophy, label: "Leaderboard" },
  { href: "/badges", icon: Medal, label: "Badges" },
  { href: "/profile", icon: User, label: "Profile" },
  { href: "/premium", icon: Gem, label: "Premium" },
];

const tierMeta: Record<string, { emoji: string; gradient: string }> = {
  "Negative Aura": { emoji: "💀", gradient: "from-red-500/20 to-red-900/10" },
  NPC: { emoji: "🗿", gradient: "from-slate-500/20 to-slate-700/10" },
  Civilian: { emoji: "😐", gradient: "from-violet-500/20 to-indigo-700/10" },
  "Rising Star": { emoji: "⭐", gradient: "from-blue-500/20 to-cyan-700/10" },
  "Main Character": { emoji: "🔥", gradient: "from-amber-500/20 to-orange-700/10" },
  Legendary: { emoji: "👑", gradient: "from-yellow-400/20 to-amber-600/10" },
  Mythical: { emoji: "⚡", gradient: "from-purple-500/20 to-violet-700/10" },
  "GOD MODE": { emoji: "🌟", gradient: "from-yellow-300/30 to-amber-500/10" },
};

export function Sidebar({ profile }: { profile: ProfileData }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("See you soon! ✌️");
    router.push("/");
    router.refresh();
  }

  const tier = tierMeta[profile?.current_tier || "NPC"] || tierMeta.NPC;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col border-r border-border/50 bg-card/40 backdrop-blur-xl lg:flex">
      {/* ─── Logo ─── */}
      <div className="flex items-center gap-3 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <Crown className="h-[18px] w-[18px] text-primary" />
        </div>
        <div>
          <h1 className="heading text-lg grad-text">AuraMint</h1>
          <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">by NovaMint</p>
        </div>
      </div>

      {/* ─── Aura Widget ─── */}
      {profile && (
        <div className={`noise relative mx-4 mt-2 overflow-hidden rounded-2xl bg-gradient-to-br ${tier.gradient} p-4`}>
          <div className="relative z-10 flex items-center gap-2.5">
            <span className="text-xl">{tier.emoji}</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              {profile.current_tier}
            </span>
          </div>
          <p className="relative z-10 mono mt-1.5 text-[28px] font-extrabold leading-none tracking-tighter">
            {formatAuraPoints(profile.total_aura)}
          </p>
          <div className="relative z-10 mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Flame className="h-3 w-3 text-orange-400" />
              {profile.streak_days}d streak
            </span>
            {profile.is_premium && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                Pro
              </span>
            )}
          </div>
        </div>
      )}

      {/* ─── Nav ─── */}
      <nav className="mt-6 flex-1 space-y-0.5 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-2.5 text-[13px] font-medium transition-all",
                isActive
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
              {item.href === "/premium" && !profile?.is_premium && (
                <Sparkles className="ml-auto h-3 w-3 text-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ─── Bottom ─── */}
      <div className="space-y-1 border-t border-border/50 p-3">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-[13px] text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-[13px] text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Log Out
        </button>

        {/* User pill */}
        {profile && (
          <div className="mt-1 flex items-center gap-3 rounded-xl bg-secondary/30 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {(profile.display_name || profile.username).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{profile.display_name || profile.username}</p>
              <p className="truncate text-[11px] text-muted-foreground">@{profile.username}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
