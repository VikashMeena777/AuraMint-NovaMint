import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layouts/sidebar";
import { BottomNav } from "@/components/layouts/bottom-nav";
import { CommandPalette } from "@/components/layouts/command-palette";
import { SubmitEventModal } from "@/components/aura/submit-event-modal";
import { getTierForAura } from "@/lib/ai/prompts";

export const dynamic = "force-dynamic";

type ProfileRow = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  total_aura: number | null;
  streak_days: number | null;
  is_premium: boolean | null;
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url, total_aura, streak_days, is_premium")
    .eq("id", user.id)
    .single();

  const row = data as ProfileRow | null;

  // Tier is DERIVED from the aura balance everywhere, from one helper. The previous
  // layout wrote `current_tier = "NPC"` into the database on a >36h gap while leaving
  // `total_aura` untouched, which is why the sidebar could read "NPC · 500.0K" while the
  // profile showed "Legendary". A read-only render must not mutate entitlements.
  const userProfile = row
    ? {
        username: row.username ?? "",
        display_name: row.display_name ?? "",
        avatar_url: row.avatar_url ?? "",
        total_aura: row.total_aura ?? 0,
        current_tier: getTierForAura(row.total_aura ?? 0).name,
        streak_days: row.streak_days ?? 0,
        is_premium: Boolean(row.is_premium),
      }
    : null;

  return (
    <div className="relative flex min-h-screen bg-background">
      {/* Ledger spine: an opaque ink/paper canvas with a single hairline rule. This also
          masks the legacy aurora orbs still mounted in the root layout. */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <div className="absolute inset-x-0 top-0 h-px bg-[#C9A227]/25" />
      </div>

      <Sidebar profile={userProfile} />

      <main id="content" className="relative z-10 min-w-0 flex-1 pb-24 lg:pb-0 lg:pl-[290px]">
        <div className="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-6">{children}</div>
      </main>

      <BottomNav />

      <CommandPalette />

      {/* One global log sheet: the mobile Log action and the command palette both work on
          every route now, not only on /dashboard. */}
      <SubmitEventModal />
    </div>
  );
}
