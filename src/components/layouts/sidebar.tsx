"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crown, LayoutDashboard, Trophy, User, Gem, Flame, Moon, Sun, LogOut, Sparkles, Medal } from "lucide-react";
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
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[290px] flex-col border-r border-border/25 bg-card/25 backdrop-blur-3xl lg:flex py-6 px-4">
      {/* ─── Header Logo ─── */}
      <div className="flex items-center gap-3.5 px-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 border border-primary/5 shadow-sm">
          <Crown className="h-[20px] w-[20px] text-primary" />
        </div>
        <div>
          <h1 className="heading text-xl tracking-tighter grad-text leading-none">AuraMint</h1>
          <p className="text-[9px] uppercase tracking-[0.2em] font-extrabold text-muted-foreground/50 mt-1">by NovaMint</p>
        </div>
      </div>

      {/* ─── Aura Tier Card Widget ─── */}
      {profile && (
        <div className={cn(
          "noise relative overflow-hidden rounded-3xl border border-border/30 bg-gradient-to-br p-5 shadow-lg mb-6",
          tier.gradient
        )}>
          {/* Saturated visual blobs inside the card */}
          <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-primary/10 blur-xl" />
          
          <div className="relative z-10 flex items-center gap-2">
            <PremiumIcon emoji={tier.emoji} className="h-5 w-5 animate-pulse" />
            <span className={cn("text-[10px] font-bold uppercase tracking-widest", tier.textClass)}>
              {profile.current_tier}
            </span>
          </div>
          
          <p className="relative z-10 mono mt-3 text-3xl font-black tracking-tighter leading-none">
            {formatAuraPoints(profile.total_aura)}
          </p>
          
          <div className="relative z-10 mt-4 flex items-center gap-4 text-xs font-semibold text-muted-foreground/80">
            <span className="flex items-center gap-1">
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
      )}

      {/* ─── Navigation Options ─── */}
      <nav className="flex-1 space-y-1.5 px-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-xs font-bold uppercase tracking-wider transition-all",
                isActive
                  ? "bg-primary/10 border border-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary/45 hover:text-foreground border border-transparent"
              )}
            >
              <item.icon className="h-4.5 w-4.5 transition group-hover:scale-105" />
              <span>{item.label}</span>
              {item.href === "/premium" && !profile?.is_premium && (
                <Sparkles className="ml-auto h-3.5 w-3.5 text-primary animate-pulse" />
              )}
              {isActive && (
                <motion.div
                  layoutId="active-indicator"
                  className="absolute left-0 w-1 h-5 rounded-r-full bg-primary"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ─── Bottom Profile / Action pill ─── */}
      <div className="space-y-2 border-t border-border/25 pt-5 px-1">
        {/* Toggle Theme / Logout buttons */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex items-center justify-center gap-2 rounded-2xl border border-border/30 bg-card/10 py-3 text-xs font-semibold text-muted-foreground transition hover:bg-secondary/50 hover:text-foreground"
            title={theme === "dark" ? "Switch to Light" : "Switch to Dark"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span>Theme</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 rounded-2xl border border-transparent bg-destructive/5 py-3 text-xs font-semibold text-destructive/80 transition hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>

        {/* User Pill */}
        {profile && (
          <div className="flex items-center gap-3 rounded-2xl border border-border/30 bg-secondary/15 p-3.5 mt-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/5 text-xs font-black text-primary">
              {(profile.display_name || profile.username).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold leading-tight">{profile.display_name || profile.username}</p>
              <p className="truncate text-[10px] font-semibold text-muted-foreground/60 mt-0.5">@{profile.username}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
