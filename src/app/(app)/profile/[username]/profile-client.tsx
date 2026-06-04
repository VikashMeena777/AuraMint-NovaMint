"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Calendar, TrendingUp, TrendingDown, Sparkles, User, X } from "lucide-react";
import { cn, formatAuraPoints } from "@/lib/utils";
import { AuraEventCard } from "@/components/aura/aura-event-card";
import { PremiumIcon } from "@/components/aura/premium-icon";
import { getTierForAura, getTierProgress } from "@/lib/ai/prompts";
import { updateProfile } from "@/lib/actions/aura-actions";
import { toast } from "sonner";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

const tierEmojis: Record<string, string> = {
  "Negative Aura": "💀", NPC: "🗿", Civilian: "😐", "Rising Star": "⭐",
  "Main Character": "🔥", Legendary: "👑", Mythical: "⚡", "GOD MODE": "🌟",
};

export function ProfileClient({
  profile,
  events,
  history,
  isOwnProfile,
}: {
  profile: any;
  events: any[];
  history: any[];
  isOwnProfile: boolean;
}) {
  const tier = getTierForAura(profile.total_aura);
  const progress = getTierProgress(profile.total_aura);
  const router = useRouter();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [fullNameInput, setFullNameInput] = useState(profile.display_name || "");
  const [usernameInput, setUsernameInput] = useState(profile.username || "");
  const [saving, setSaving] = useState(false);

  async function handleSaveProfile() {
    if (!fullNameInput.trim()) {
      toast.error("Please enter your name");
      return;
    }
    const cleanUsername = usernameInput.trim().toLowerCase();
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(cleanUsername)) {
      toast.error("Username must be 3-20 characters, only letters, numbers, and underscores");
      return;
    }

    setSaving(true);
    const result = await updateProfile(cleanUsername, fullNameInput.trim());
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Profile updated successfully! ✨");
    setIsEditModalOpen(false);

    if (cleanUsername !== profile.username) {
      router.push(`/profile/${cleanUsername}`);
    } else {
      router.refresh();
    }
  }

  // Build chart data — cumulative aura over time
  let cumulative = 0;
  const chartData = history.map((h: any) => {
    cumulative += h.aura_points;
    const date = new Date(h.created_at);
    return {
      date: `${date.getDate()}/${date.getMonth() + 1}`,
      aura: cumulative,
    };
  });

  // Stats calculate
  const biggestW = events.length > 0
    ? Math.max(...events.map((e: any) => e.aura_points))
    : 0;
  const biggestL = events.length > 0
    ? Math.min(...events.map((e: any) => e.aura_points))
    : 0;

  return (
    <div className="space-y-6">
      {/* Profile Header card box */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="glass overflow-hidden rounded-3xl border border-border/30 shadow-2xl relative"
      >
        {/* Banner holographic visual gradient */}
        <div className="h-28 bg-gradient-to-r from-primary/15 via-accent/15 to-primary/10 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
        </div>

        <div className="px-6 pb-6 relative z-10">
          {/* Avatar and title block */}
          <div className="-mt-12 mb-5 flex items-end gap-4">
            <div className="flex h-22 w-22 items-center justify-center rounded-2xl border-4 border-card bg-primary/15 text-4xl font-bold text-primary shadow-xl select-none">
              {(profile.display_name || profile.username).charAt(0).toUpperCase()}
            </div>
            <div className="pb-1.5 min-w-0 flex-1">
              <h1 className="heading text-2xl font-black tracking-tight leading-none truncate">
                {profile.display_name || profile.username}
              </h1>
              <p className="text-xs font-semibold text-muted-foreground/60 mt-1 truncate">
                @{profile.username}
              </p>
            </div>
            {isOwnProfile && (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="mb-1.5 rounded-xl border border-border bg-card/65 px-4.5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition active:scale-95 shrink-0 shadow-sm"
              >
                Edit Profile
              </button>
            )}
          </div>

          {/* Aura score balances */}
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-border/20">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/60">
                Total Aura Balance
              </p>
              <p className="heading text-3xl font-black tracking-tight text-primary mt-1 leading-none">
                {formatAuraPoints(profile.total_aura)}
              </p>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="rounded-2xl bg-primary/15 border border-primary/20 px-4 py-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                <PremiumIcon emoji={tierEmojis[tier.name]} className="h-4 w-4" />
                <span>{tier.name}</span>
              </div>

              {profile.streak_days > 0 && (
                <div className="flex items-center gap-1.5 rounded-2xl bg-orange-500/10 border border-orange-500/25 px-4 py-2 text-xs font-bold uppercase tracking-wider text-orange-400">
                  <Flame className="h-4 w-4" />
                  <span>{profile.streak_days}d Streak</span>
                </div>
              )}

              {profile.is_premium && (
                <span className="rounded-2xl bg-gradient-to-r from-yellow-500/15 to-amber-500/15 border border-yellow-500/25 px-3 py-2 text-[10px] font-extrabold uppercase tracking-widest text-primary">
                  ✨ Pro
                </span>
              )}
            </div>
          </div>

          {/* Dynamic Tier Progress Slider */}
          {progress.next && (
            <div className="mt-5 border-t border-border/20 pt-4">
              <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/80">
                <span>
                  {tier.emoji} {tier.name}
                </span>
                <span>
                  {progress.next.emoji} {progress.next.name} ({formatAuraPoints(progress.remaining)} to go)
                </span>
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-secondary border border-border/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.progress}%` }}
                  transition={{ duration: 1.2, delay: 0.35, ease: "easeOut" }}
                />
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Profile Metrics Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Events", value: events.length, icon: Calendar, color: "text-muted-foreground/70 bg-card/25" },
          { label: "Biggest W", value: `+${formatAuraPoints(biggestW)}`, icon: TrendingUp, color: "text-emerald-400 bg-emerald-500/5 border-emerald-500/15" },
          { label: "Biggest L", value: formatAuraPoints(biggestL), icon: TrendingDown, color: "text-red-400 bg-red-500/5 border-red-500/15" },
          { label: "Current Streak", value: `${profile.streak_days}d`, icon: Flame, color: "text-orange-400 bg-orange-500/5 border-orange-500/15" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.08, ease: "easeOut" }}
            className={cn("glass p-4 border border-border/30 rounded-2xl flex flex-col items-start justify-between min-h-[96px]", stat.color)}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-card/20 border border-border/10">
              <stat.icon className="h-4 w-4" />
            </div>
            <div className="mt-3">
              <p className="mono text-base font-black tracking-tight">
                {stat.value}
              </p>
              <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground/60 mt-0.5">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Aura history Area chart visual */}
      {chartData.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="glass p-6 border border-border/30 rounded-3xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="heading text-base tracking-tight leading-none">
              Aura Journey 📈
            </h2>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/50">Historical Progression</span>
          </div>
          
          <div className="w-full pt-2">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="auraGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontWeight: "bold" }} 
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontWeight: "bold" }} 
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border) / 0.5)",
                    borderRadius: "16px",
                    fontSize: "11px",
                    fontWeight: "bold",
                    fontFamily: "var(--font-sans)",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.12)"
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="aura"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  fill="url(#auraGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Recent user events list feed */}
      <div className="pt-2">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="heading text-base tracking-tight leading-none">
            Recent Events
          </h2>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/50">Log History</span>
        </div>
        
        {events.length === 0 ? (
          <div className="glass noise flex flex-col items-center py-16 text-center border border-border/30 rounded-3xl">
            <Sparkles className="mb-3 h-10 w-10 text-muted-foreground/30 animate-pulse" />
            <p className="heading text-sm text-muted-foreground">No events logged yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event, i) => (
              <AuraEventCard key={event.id} event={event} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center p-4"
            onClick={(e) => e.target === e.currentTarget && setIsEditModalOpen(false)}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="relative w-full max-w-md rounded-t-[2rem] bg-card p-7 shadow-2xl border border-border/40 sm:rounded-[2rem] overflow-hidden"
            >
              <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

              {/* Close Button */}
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="absolute right-5 top-5 z-20 rounded-xl border border-border bg-card/40 p-2.5 text-muted-foreground hover:text-foreground transition"
              >
                <X className="h-4.5 w-4.5" />
              </button>

              <div className="relative z-10">
                <div className="mb-6 text-center">
                  <h2 className="heading text-xl tracking-tight leading-none">Edit Profile</h2>
                  <p className="mt-1.5 text-xs text-muted-foreground">Update your public identity details</p>
                </div>

                <div className="space-y-4">
                  {/* Name field */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/80 pl-1">Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                      <input
                        type="text"
                        value={fullNameInput}
                        onChange={(e) => setFullNameInput(e.target.value)}
                        placeholder="Full Name"
                        className="w-full rounded-2xl border border-border/80 bg-secondary/15 py-3.5 pl-11 pr-4 text-xs font-semibold transition placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-secondary/35 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Username field */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/80 pl-1">Username</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground/60">@</span>
                      <input
                        type="text"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20))}
                        placeholder="username"
                        className="w-full rounded-2xl border border-border/80 bg-secondary/15 py-3.5 pl-8 pr-4 text-xs font-semibold transition placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-secondary/35 focus:outline-none"
                      />
                    </div>
                    <p className="text-[9px] text-muted-foreground/50 pl-1 font-semibold uppercase tracking-wider leading-relaxed">
                      💡 Note: You can change your username at most **twice every 15 days**.
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-4 flex gap-3">
                    <button
                      onClick={() => setIsEditModalOpen(false)}
                      className="flex-1 rounded-2xl border border-border bg-card/45 py-3.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition active:scale-95"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-xs font-extrabold uppercase tracking-wider text-primary-foreground transition hover:brightness-110 shadow-lg glow-brand disabled:opacity-50 active:scale-95"
                    >
                      {saving ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/20 border-t-primary-foreground" />
                      ) : (
                        <>
                          Save Changes
                          <Sparkles className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
