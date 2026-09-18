import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUserProfile } from "@/lib/actions/aura-actions";
import { createClient } from "@/lib/supabase/server";
import { ProfileClient } from "./profile-client";
import type { AuraEvent, AuraHistoryPoint, PublicProfile } from "@/components/aura/types";

type Params = Promise<{ username: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username } = await params;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("username, display_name, total_aura, current_tier")
      .eq("username", username)
      .maybeSingle();
    const row = data as { username?: string; display_name?: string | null; total_aura?: number | null; current_tier?: string | null } | null;
    if (!row?.username) return { title: "Profile not found" };
    const name = row.display_name || row.username;
    return {
      title: `@${row.username}`,
      description: `${name} · ${(row.total_aura ?? 0).toLocaleString("en-IN")} aura · ${row.current_tier ?? "NPC"} on AuraMint.`,
    };
  } catch {
    return { title: `@${username}` };
  }
}

export default async function ProfilePage({ params }: { params: Params }) {
  const { username } = await params;
  const result = await getUserProfile(username);

  if (!result || !("profile" in result) || !result.profile) {
    notFound();
  }

  const profile = result.profile as PublicProfile;
  const events = ("events" in result ? result.events : []) as AuraEvent[];
  const history = ("history" in result ? result.history : []) as AuraHistoryPoint[];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwnProfile = Boolean(user && profile.id === user.id);

  return (
    <ProfileClient profile={profile} events={events} history={history} isOwnProfile={isOwnProfile} />
  );
}
