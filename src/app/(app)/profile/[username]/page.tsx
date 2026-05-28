import { getUserProfile } from "@/lib/actions/aura-actions";
import { notFound } from "next/navigation";
import { ProfileClient } from "./profile-client";

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

  return (
    <ProfileClient
      profile={result.profile}
      events={result.events || []}
      history={result.history || []}
    />
  );
}
