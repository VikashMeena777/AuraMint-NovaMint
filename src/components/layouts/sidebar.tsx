"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crown, LayoutDashboard, Trophy, User, Gem, Flame, Moon, Sun, LogOut, Sparkles, Medal, BarChart3 } from "lucide-react";
import { useTheme } from "next-themes";
import { cn, formatAuraPoints } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { PremiumIcon } from "@/components/aura/premium-icon";

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
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/profile", icon: User, label: "Profile" },
  { href: "/premium", icon: Gem, label: "Premium" },
];

const tierMeta: Record<string, { emoji: string; gradient: string; textClass: string }> = {
  "Negative Aura": { emoji: "💀", gradient: "from-red-950/40 via-red-900/20 to-red-950/40", textClass: "text-red-400" },
  NPC: { emoji: "🗿", gradient: "from-slate-900/40 via-slate-800/20 to-slate-900/40", textClass: "text-slate-400" },
  Civilian: { emoji: "😐", gradient: "from-violet-950/40 via-violet-900/20 to-violet-950/40", textClass: "text-violet-400" },
  "Rising Star": { emoji: "⭐", gradient: "from-blue-950/40 via-blue-900/20 to-blue-950/40", textClass: "text-blue-400" },
  "Main Character": { emoji: "🔥", gradient: "from-amber-950/40 via-amber-900/20 to-amber-950/40", textClass: "text-amber-400" },
  Legendary: { emoji: "👑", gradient: "from-yellow-950/40 via-yellow-900/20 to-yellow-950/40", textClass: "text-yellow-400" },
  Mythical: { emoji: "⚡", gradient: "from-purple-950/40 via-purple-900/20 to-purple-950/40", textClass: "text-purple-400" },
  "GOD MODE": { emoji: "🌟", gradient: "from-amber-900/50 via-yellow-900/30 to-amber-900/50", textClass: "text-yellow-400 font-extrabold" },
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
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[290px] flex-col lg:flex py-6 px-4 glass-card border-r border-border/30 rounded-none">
      <div className="grain-overlay" />

      {/* ─── Header Logo ─── */}
      <Link href="/" className="relative z-10 flex items-center gap-3 px-3 mb-8 cursor-pointer hover:opacity-90 transition select-none">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/15">
          <Crown className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="heading text-xl tracking-tighter grad-gold leading-none">AuraMint</h1>
          <p className="text-[9px] uppercase tracking-[0.2em] font-extrabold text-muted-foreground/50 mt-1">by NovaMint</p>
        </div>
      </Link>

      {/* ─── Aura Score + Tier Widget ─── */}
      {profile && (
        <div className="relative z-10 mb-6">
          <div className={cn(
            "relative overflow-hidden rounded-2xl border border-border/30 bg-gradient-to-br p-5",
            tier.gradient
          )}>
            <div className="grain-overlay" />
            <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-primary/10 blur-xl" />
            
            <div className="relative z-10 flex items-center gap-2">
              <PremiumIcon emoji={tier.emoji} className="h-5 w-5" />
              <span className={cn("text-[10px] font-bold uppercase tracking-widest", tier.textClass)}>
                {profile.current_tier}
              </span>
            </div>
            
            {/* Big aura score with golden glow */}
            <p className="relative z-10 mono mt-3 text-3xl font-black tracking-tighter leading-none" style={{ textShadow: "0 0 20px rgba(232,163,23,0.3)" }}>
              {formatAuraPoints(profile.total_aura)}
            </p>
            <p className="relative z-10 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mt-1">Total Aura</p>
            
            {/* Streak + Pro badge */}
            <div className="relative z-10 mt-4 flex items-center gap-4 text-xs font-semibold text-muted-foreground/80">
              <span className="flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-orange-400" />
                {profile.streak_days}d streak
              </span>
              {profile.is_premium && (
                <span className="rounded-full bg-primary/15 border border-primary/25 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                  Pro
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Navigation ─── */}
      <nav className="relative z-10 flex-1 space-y-1.5 px-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3.5 rounded-xl px-4 py-3.5 text-xs font-bold uppercase tracking-wider transition-all",
                isActive
                  ? "bg-primary/10 border border-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted/30 dark:hover:bg-white/5 hover:text-foreground border border-transparent"
              )}
            >
              <item.icon className="h-4.5 w-4.5 transition group-hover:scale-105" />
              <span>{item.label}</span>
              {item.href === "/premium" && !profile?.is_premium && (
                <span className="ml-auto rounded-full bg-primary/15 border border-primary/25 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-primary">
                  Pro
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="active-indicator"
                  className="absolute left-0 w-1 h-5 rounded-r-full bg-primary shadow-[0_0_8px_rgba(232,163,23,0.5)]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ─── Bottom Actions ─── */}
      <div className="relative z-10 space-y-2 border-t border-border/30 pt-5 px-1">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex items-center justify-center gap-2 rounded-xl border border-border/30 bg-muted/15 dark:bg-white/3 py-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted/40 dark:hover:bg-white/8 hover:text-foreground"
            title={theme === "dark" ? "Switch to Light" : "Switch to Dark"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span>Theme</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 rounded-xl border border-transparent bg-red-500/5 py-3 text-xs font-semibold text-red-400/80 transition hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>

        {/* User pill */}
        {profile && (
          <div className="flex items-center gap-3 rounded-xl border border-border/30 bg-muted/15 dark:bg-white/3 p-3.5 mt-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/15 text-xs font-black text-primary">
              {(profile.display_name || profile.username).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold leading-tight">{profile.display_name || profile.username}</p>
              <p className="truncate mono text-[10px] font-semibold text-muted-foreground/60 mt-0.5">@{profile.username}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
