export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layouts/sidebar";
import { BottomNav } from "@/components/layouts/bottom-nav";
import { CommandPalette } from "@/components/layouts/command-palette";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const userProfile = profile as {
    username: string;
    display_name: string;
    avatar_url: string;
    total_aura: number;
    current_tier: string;
    streak_days: number;
    is_premium: boolean;
    last_active_date?: string;
  } | null;

  // Loss Aversion: "NPC demotion loop" for inactivity > 36 hours
  if (userProfile && userProfile.last_active_date) {
    const today = new Date();
    const lastActive = new Date(userProfile.last_active_date);
    const diffTime = Math.abs(today.getTime() - lastActive.getTime());
    const diffHours = diffTime / (1000 * 60 * 60);

    if (diffHours > 36 && userProfile.current_tier !== "NPC") {
      userProfile.current_tier = "NPC";
      userProfile.streak_days = 0;

      // Persist the downgrade back to database dynamically
      await supabase
        .from("profiles")
        .update({
          current_tier: "NPC",
          streak_days: 0,
        })
        .eq("id", user.id);
    }
  }

  return (
    <div className="relative flex min-h-screen">
      {/* Cosmic Background for App */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 cosmic-mesh opacity-40" />
        <div className="absolute inset-0 dot-grid opacity-20" />
      </div>

      {/* Desktop Sidebar */}
      <Sidebar profile={userProfile} />

      {/* Main Content */}
      <main className="relative z-10 flex-1 pb-24 lg:pb-0 lg:pl-[290px]">
        <div className="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-6">{children}</div>
      </main>

      {/* Mobile Bottom Nav */}
      <BottomNav />

      {/* Command Palette Shortcut Portal */}
      <CommandPalette />
    </div>
  );
}
