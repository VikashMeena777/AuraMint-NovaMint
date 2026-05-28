export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layouts/sidebar";
import { BottomNav } from "@/components/layouts/bottom-nav";

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
  } | null;

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <Sidebar profile={userProfile} />

      {/* Main Content */}
      <main className="flex-1 pb-24 lg:pb-0 lg:pl-72">
        <div className="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-6">{children}</div>
      </main>

      {/* Mobile Bottom Nav */}
      <BottomNav />
    </div>
  );
}
