"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Flame, Calendar, TrendingUp, TrendingDown, Sparkles, User, Share2, Trophy, Rocket } from "lucide-react";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AuraEventCard } from "@/components/aura/aura-event-card";
import { AuraNumber } from "@/components/aura/aura-number";
import { Chip, IconButton, Plate, PrimaryButton, SectionLabel } from "@/components/aura/primitives";
import { TierMark } from "@/components/aura/tier-mark";
import { MintDialog } from "@/components/aura/mint-dialog";
import { SoundToggleRow } from "@/components/aura/sound-toggle";
import { useViewer } from "@/components/aura/hooks";
import { getTierForAura, getTierProgress } from "@/lib/ai/prompts";
import { profileShareUrl } from "@/components/aura/mint";
import { updateProfile } from "@/lib/actions/aura-actions";
import type { AuraEvent, AuraHistoryPoint, PublicProfile } from "@/components/aura/types";
import { playHapticPop } from "@/lib/utils/sound";

/** Pure, day-bucketed cumulative series (was: a `let` mutated during render). */
function buildJourney(history: AuraHistoryPoint[]) {
  const byDay = new Map<number, { label: string; delta: number }>();
  for (const point of history) {
    const date = new Date(point?.created_at ?? "");
    const ts = date.getTime();
    if (!Number.isFinite(ts)) continue;
    const dayKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const existing = byDay.get(dayKey);
    byDay.set(dayKey, {
      label: `${date.getDate()}/${date.getMonth() + 1}`,
      delta: (existing?.delta ?? 0) + (point.aura_points ?? 0),
    });
  }
  const ordered = [...byDay.entries()].sort((a, b) => a[0] - b[0]);
  let running = 0;
  return ordered.map(([ts, value]) => {
    running += value.delta;
    return { ts, date: value.label, aura: running, delta: value.delta };
  });
}

export function ProfileClient({
  profile,
  events,
  history,
  isOwnProfile,
}: {
  profile: PublicProfile;
  events: AuraEvent[];
  history: AuraHistoryPoint[];
  isOwnProfile: boolean;
}) {
  const router = useRouter();
  const viewer = useViewer();
  const reducedMotion = useReducedMotion();
  const [editOpen, setEditOpen] = useState(false);
  const [fullNameInput, setFullNameInput] = useState(profile.display_name ?? "");
  const [usernameInput, setUsernameInput] = useState(profile.username ?? "");
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);

  const totalAura = profile.total_aura ?? 0;
  const tier = getTierForAura(totalAura);
  const progress = getTierProgress(totalAura);

  const journey = useMemo(() => buildJourney(history), [history]);

  // Stats come from the 30-day history (the events array is capped at 20 rows), so the
  // labels are honest: "Events · 30d" is the real count, not "Total events".
  const biggestW = history.length > 0 ? Math.max(0, ...history.map((h) => h.aura_points ?? 0)) : 0;
  const biggestL = history.length > 0 ? Math.min(0, ...history.map((h) => h.aura_points ?? 0)) : 0;

  function openEdit() {
    setFullNameInput(profile.display_name ?? "");
    setUsernameInput(profile.username ?? "");
    setEditOpen(true);
    playHapticPop();
  }

  async function handleSaveProfile() {
    if (saving) return;
    const cleanName = fullNameInput.trim();
    const cleanUsername = usernameInput.trim().toLowerCase();
    if (cleanName.length < 2) {
      toast.error("Enter a display name with at least 2 characters.");
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      toast.error("Usernames are 3–20 characters: lowercase letters, numbers, underscores.");
      return;
    }

    setSaving(true);
    try {
      const result = (await updateProfile(cleanUsername, cleanName)) as { error?: string; success?: boolean };
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Profile updated.");
      setEditOpen(false);
      if (cleanUsername !== profile.username) router.push(`/profile/${cleanUsername}`);
      else router.refresh();
    } catch {
      toast.error("Couldn't save your profile. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleShareProfile() {
    if (sharing) return;
    setSharing(true);
    playHapticPop();
    const url = profileShareUrl(profile.username);
    const text = `@${profile.username} · ${totalAura.toLocaleString("en-IN")} aura · ${tier.name} on AuraMint`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ text, url });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast.success("Profile link copied.");
      } else {
        throw new Error("no share target");
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) toast.error("Couldn't share the profile.");
    } finally {
      setSharing(false);
    }
  }

  const stats = [
    {
      label: "Events · 30d",
      icon: Calendar,
      node: <span className="font-mono text-base font-bold tabular-nums text-foreground">{history.length}</span>,
    },
    { label: "Biggest W · 30d", icon: TrendingUp, node: <AuraNumber value={biggestW} size="sm" /> },
    { label: "Biggest L · 30d", icon: TrendingDown, node: <AuraNumber value={biggestL} size="sm" /> },
    {
      label: "Streak",
      icon: Flame,
      node: (
        <span className="font-mono text-base font-bold tabular-nums text-foreground">
          {profile.streak_days ?? 0}d
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Specimen header */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.3 }}
      >
        <Plate className="p-5">
          <div className="flex items-start gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-secondary/40 font-display text-2xl text-foreground">
              {(profile.display_name || profile.username).charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-2xl leading-tight text-foreground">
                {profile.display_name || profile.username}
              </h1>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">@{profile.username}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Chip tone="lead" className="gap-2">
                  <TierMark tier={tier.name} size="sm" />
                  <span className="normal-case tracking-normal">{tier.name}</span>
                </Chip>
                {(profile.streak_days ?? 0) > 0 ? (
                  <Chip tone="brass">
                    <Flame className="h-3 w-3" aria-hidden="true" />
                    {profile.streak_days}d
                  </Chip>
                ) : null}
                {profile.is_premium ? (
                  <Chip tone="brass">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    Premium
                  </Chip>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="text-right">
                <SectionLabel>Balance</SectionLabel>
                <span className="mt-1 block">
                  <AuraNumber value={totalAura} size="lg" signed={false} />
                </span>
              </span>
              <div className="flex items-center gap-2">
                <IconButton label="Share this profile" onClick={handleShareProfile} loading={sharing}>
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                </IconButton>
                {isOwnProfile ? (
                  <button
                    type="button"
                    onClick={openEdit}
                    className="rounded-lg border border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Edit
                  </button>
                ) : (
                  <Link
                    href={viewer.username ? `/vs/${viewer.username}/${profile.username}` : "/leaderboard"}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Duel
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Tier progress as a struck notch bar (no gradient) */}
          {progress.next ? (
            <div className="mt-5 border-t border-border/60 pt-4">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <span>
                  {tier.name} → {progress.next.name}
                </span>
                <span className="font-mono tabular-nums">{Math.round(progress.progress)}%</span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress.progress)}
                aria-label={`Progress to ${progress.next.name}`}
                className="mt-2.5 flex gap-1"
              >
                {Array.from({ length: 20 }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-2 flex-1 rounded-sm",
                      i < Math.round(progress.progress / 5) ? "bg-[#1F6F5C]" : "bg-secondary"
                    )}
                  />
                ))}
              </div>
              <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {Math.max(0, progress.remaining).toLocaleString("en-IN")} aura to the next hallmark
              </p>
            </div>
          ) : null}
        </Plate>
      </motion.div>

      {/* Ledger cells */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <Plate key={stat.label} className="p-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-secondary/40 text-muted-foreground">
              <stat.icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="mt-3">
              {stat.node}
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{stat.label}</p>
            </div>
          </Plate>
        ))}
      </div>

      {/* Journey chart */}
      {journey.length > 1 ? (
        <Plate className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg text-foreground">Aura journey</h2>
            <SectionLabel>Cumulative · 30d</SectionLabel>
          </div>
          <div className="w-full">
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={journey} margin={{ left: -14, right: 8, top: 4, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontFamily: "var(--font-sans)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="aura"
                  stroke="#1F6F5C"
                  strokeWidth={2}
                  fill="#1F6F5C"
                  fillOpacity={0.12}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Plate>
      ) : null}

      {/* Own-account controls that must be reachable on mobile */}
      {isOwnProfile ? (
        <Plate className="p-5">
          <SoundToggleRow />
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
            <Link
              href="/badges"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
              Badges
            </Link>
            <Link
              href="/premium"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Premium
            </Link>
            <Link
              href="/wrapped"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
              Wrapped
            </Link>
          </div>
        </Plate>
      ) : null}

      {/* Recent entries */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg text-foreground">Recent entries</h2>
          <SectionLabel>Latest {events.length}</SectionLabel>
        </div>
        {events.length === 0 ? (
          <Plate className="px-5 py-10 text-center">
            <p className="text-sm text-muted-foreground">No public entries yet.</p>
          </Plate>
        ) : (
          <div className="space-y-4">
            {events.map((event, i) => (
              <AuraEventCard
                key={event.id}
                event={event}
                index={i}
                isOwner={isOwnProfile}
                isPremium={isOwnProfile ? viewer.isPremium : Boolean(profile.is_premium)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Edit profile */}
      <MintDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit profile"
        description="Your public identity in the ledger."
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="profile-display-name" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Display name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                id="profile-display-name"
                type="text"
                value={fullNameInput}
                onChange={(e) => setFullNameInput(e.target.value.slice(0, 60))}
                autoComplete="name"
                className="w-full rounded-xl border border-border bg-secondary/20 py-3 pl-10 pr-3 text-sm text-foreground focus:border-[#1F6F5C]/60 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="profile-username" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
              <input
                id="profile-username"
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
                autoComplete="username"
                aria-describedby="profile-username-note"
                className="w-full rounded-xl border border-border bg-secondary/20 py-3 pl-8 pr-3 text-sm text-foreground focus:border-[#1F6F5C]/60 focus:outline-none"
              />
            </div>
            <p id="profile-username-note" className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Lowercase letters, numbers and underscores, 3–20 characters. You can change a handle{" "}
              <strong className="font-semibold text-foreground">twice every 15 days</strong>.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="flex-1 rounded-xl border border-border py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
            <PrimaryButton className="flex-1" onClick={handleSaveProfile} loading={saving}>
              Save changes
            </PrimaryButton>
          </div>
        </div>
      </MintDialog>
    </div>
  );
}
