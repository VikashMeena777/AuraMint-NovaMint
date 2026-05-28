import { getUserProfile } from "@/lib/actions/aura-actions";
import { notFound } from "next/navigation";
import { ProfileClient } from "./profile-client";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const result = await getUserProfile(username);

  if (result.error) {
    notFound();
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isOwnProfile = user ? result.profile.id === user.id : false;

  return (
    <ProfileClient
      profile={result.profile}
      events={result.events || []}
      history={result.history || []}
      isOwnProfile={isOwnProfile}
    />
  );
}
