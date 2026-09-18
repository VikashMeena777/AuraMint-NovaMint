import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * `/profile` resolves to the viewer's own specimen sheet. A brand-new account still
 * carries a generated `user_xxx` handle, so those are routed through onboarding once to
 * claim a real handle — previously nothing in the app ever linked to `/onboarding`.
 */
export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data } = await supabase.from("profiles").select("username").eq("id", user.id).single();
  const username = (data as { username?: string | null } | null)?.username;

  if (!username || username.startsWith("user_")) {
    redirect("/onboarding");
  }

  redirect(`/profile/${username}`);
}
