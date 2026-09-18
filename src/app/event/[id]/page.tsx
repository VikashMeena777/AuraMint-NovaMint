import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Crown, Flame, TrendingUp, TrendingDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AuraNumber } from "@/components/aura/aura-number";
import { Chip, EmojiMark, Plate } from "@/components/aura/primitives";
import { TierMark } from "@/components/aura/tier-mark";
import { categoryMeta, MINT } from "@/components/aura/mint";
import type { EventProfile } from "@/components/aura/types";

/**
 * Public event record — the destination for every shared card and QR code.
 *
 * Previously this route did not exist, so 100% of shared cards and their embedded QR
 * codes sent recipients to a bare Next 404 (the product's primary growth loop).
 *
 * It is privacy-safe by construction: the query is filtered to `is_public = true` and
 * only whitelisted columns are selected, so a private or draft event is indistinguishable
 * from a missing one (404). No session is required to read a public entry.
 */
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

type EventRecord = {
  id: string;
  user_id: string;
  description: string;
  aura_points: number;
  ai_verdict: string | null;
  ai_vibe_tag: string | null;
  ai_emoji: string | null;
  category: string | null;
  upvotes: number | null;
  downvotes: number | null;
  created_at: string;
  profiles?: EventProfile | EventProfile[] | null;
};

type Params = Promise<{ id: string }>;

async function fetchEvent(id: string): Promise<EventRecord | null> {
  if (!ID_PATTERN.test(id)) return null;
  try {
    const supabase = await createClient();
    // No profile embed: `aura_events.user_id` references `auth.users`, so
    // `profiles!aura_events_user_id_fkey` cannot resolve (PostgREST reports
    // "Could not find a relationship…"). The author is read by id instead.
    const { data, error } = await supabase
      .from("aura_events")
      .select(
        "id, user_id, description, aura_points, ai_verdict, ai_vibe_tag, ai_emoji, category, upvotes, downvotes, created_at"
      )
      .eq("id", id)
      .eq("is_public", true)
      .maybeSingle();
    if (error || !data) return null;

    const event = data as EventRecord;
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url, current_tier, is_premium")
      .eq("id", event.user_id)
      .maybeSingle();

    return { ...event, profiles: (profile as EventProfile | null) ?? null };
  } catch {
    return null;
  }
}

function profileOf(value: EventRecord["profiles"]): EventProfile | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const event = await fetchEvent(id);
  if (!event) return { title: "Entry not found" };

  const author = profileOf(event.profiles)?.username ?? "someone";
  const points = Number.isFinite(event.aura_points) ? event.aura_points : 0;
  const title = `${points >= 0 ? "+" : ""}${points} aura for @${author}`;
  const description = event.ai_verdict || event.description.slice(0, 150);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `/event/${event.id}`,
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function EventPage({ params }: { params: Params }) {
  const { id } = await params;
  const event = await fetchEvent(id);
  if (!event) notFound();

  const profile = profileOf(event.profiles);
  const points = Number.isFinite(event.aura_points) ? event.aura_points : 0;
  const isPositive = points >= 0;
  const category = categoryMeta(event.category);
  const CategoryIcon = category.icon;
  const author = profile?.username ?? null;

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-lg">
        <header className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#C9A227]/40">
              <Crown className="h-5 w-5 text-[#8A6E14] dark:text-[#C9A227]" aria-hidden="true" />
            </span>
            <span className="font-display text-2xl tracking-tight text-foreground">AuraMint</span>
          </Link>
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Public entry record
          </p>
        </header>

        <Plate rail={points} className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-secondary/40 text-sm font-bold text-foreground">
                {(profile?.display_name || author || "?").charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                {author ? (
                  <Link href={`/profile/${author}`} className="truncate text-sm font-semibold text-foreground hover:underline">
                    {profile?.display_name || author}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold text-foreground">Anonymous</span>
                )}
                <div className="mt-0.5 flex items-center gap-2">
                  <TierMark tier={profile?.current_tier} size="sm" />
                  {profile?.is_premium ? <Chip tone="brass">Premium</Chip> : null}
                </div>
              </div>
            </div>
            <Chip tone="lead" className="shrink-0">
              <CategoryIcon className="h-3 w-3" aria-hidden="true" />
              {category.label}
            </Chip>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-foreground">{event.description}</p>

          <div className="mt-5 flex items-baseline gap-3">
            <AuraNumber value={points} size="hero" />
            <EmojiMark emoji={event.ai_emoji} label="aura verdict emoji" className="text-3xl" />
          </div>

          {event.ai_verdict ? (
            <blockquote
              className="mt-4 border-l-2 pl-3 text-sm italic leading-relaxed text-muted-foreground"
              style={{ borderColor: isPositive ? MINT.patinaBright : MINT.oxide }}
            >
              {event.ai_verdict}
            </blockquote>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {event.ai_vibe_tag ? <Chip tone="pos">{event.ai_vibe_tag}</Chip> : null}
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              {event.upvotes ?? 0} W
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
              {event.downvotes ?? 0} L
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Flame className="h-3.5 w-3.5" aria-hidden="true" />
              {new Date(event.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
        </Plate>

        <div className="mt-6 text-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-[#1F6F5C] px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#F7F4EC]"
          >
            Get your aura minted
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Log a moment, get a verdict, climb the ranked ledger.
          </p>
        </div>
      </div>
    </main>
  );
}
