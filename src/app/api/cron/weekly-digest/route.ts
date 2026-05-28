import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWeeklyDigestEmail } from "@/lib/email/send";

/**
 * Cron: Weekly Leaderboard Digest (runs Sunday 10 AM IST)
 * Sends top 5 leaderboard + user's rank to all users.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Get top 5 players
    const { data: topPlayers } = await supabase
      .from("profiles")
      .select("id, username, total_aura, tier")
      .order("total_aura", { ascending: false })
      .limit(5);

    if (!topPlayers || topPlayers.length === 0) {
      return NextResponse.json({ message: "No players", sent: 0 });
    }

    const top5 = topPlayers.map((p, i) => ({
      rank: i + 1,
      username: (p as any).username || "Anonymous",
      total_aura: (p as any).total_aura || 0,
      tier: (p as any).tier || "NPC",
    }));

    // Get all users with events
    const { data: allUsers } = await supabase
      .from("profiles")
      .select("id, username, total_aura")
      .order("total_aura", { ascending: false });

    if (!allUsers) {
      return NextResponse.json({ message: "No users", sent: 0 });
    }

    let sent = 0;

    for (let i = 0; i < allUsers.length; i++) {
      const user = allUsers[i];
      const { data: authUser } = await supabase.auth.admin.getUserById((user as any).id);
      const email = authUser?.user?.email;
      if (!email) continue;

      await sendWeeklyDigestEmail(
        email,
        (user as any).username || "AuraMinter",
        i + 1, // rank
        (user as any).total_aura || 0,
        top5
      );
      sent++;

      // Rate limit: 1 email per 100ms
      await new Promise((r) => setTimeout(r, 100));
    }

    return NextResponse.json({ message: "Weekly digest sent", sent });
  } catch (err) {
    console.error("[Cron: Weekly Digest]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
