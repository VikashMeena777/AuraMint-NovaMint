import { NextRequest, NextResponse } from "next/server";
import { assertCronRequest } from "@/lib/supabase/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendWeeklyDigestEmail } from "@/lib/email/send";

/**
 * Cron: Weekly Leaderboard Digest (runs Sunday 10 AM IST)
 * Sends top 5 leaderboard + user's rank to all users.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/** Hard cap so a single run can never fan out to an unbounded recipient list. */
const MAX_RECIPIENTS = 500;
/** Pacing between provider calls. */
const SEND_INTERVAL_MS = 100;

type ProfileRow = {
  id?: string | null;
  username?: string | null;
  total_aura?: number | null;
  current_tier?: string | null;
  tier?: string | null;
};

export async function GET(req: NextRequest) {
  const unauthorized = assertCronRequest(req);
  if (unauthorized) return unauthorized;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[Cron: Weekly Digest] Supabase service-role environment is not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 503 });
  }

  try {
    // Get top 5 players. `select("*")` keeps this working regardless of whether the
    // tier column is named `current_tier` (writers) or `tier`.
    const { data: topPlayers, error: topError } = await supabase
      .from("profiles")
      .select("*")
      .order("total_aura", { ascending: false })
      .limit(5);

    if (topError) {
      console.error("[Cron: Weekly Digest] Failed to load top players:", topError.message);
      return NextResponse.json({ error: "Failed" }, { status: 500 });
    }

    if (!topPlayers || topPlayers.length === 0) {
      return NextResponse.json({ message: "No players", sent: 0 });
    }

    const top5 = (topPlayers as ProfileRow[]).map((p, i) => ({
      rank: i + 1,
      username: p.username || "Anonymous",
      total_aura: Number(p.total_aura) || 0,
      tier: p.current_tier || p.tier || "NPC",
    }));

    // Ranked list (all users, highest aura first)
    const { data: allUsers, error: allError } = await supabase
      .from("profiles")
      .select("id, username, total_aura")
      .order("total_aura", { ascending: false });

    if (allError) {
      console.error("[Cron: Weekly Digest] Failed to load ranking:", allError.message);
      return NextResponse.json({ error: "Failed" }, { status: 500 });
    }

    if (!allUsers) {
      return NextResponse.json({ message: "No users", sent: 0 });
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const limit = Math.min(allUsers.length, MAX_RECIPIENTS);

    if (allUsers.length > limit) {
      console.warn(
        `[Cron: Weekly Digest] Recipient cap reached (${MAX_RECIPIENTS}); ${allUsers.length - limit} users skipped`
      );
    }

    for (let i = 0; i < limit; i++) {
      const user = allUsers[i] as ProfileRow;
      const userId = user?.id;
      if (typeof userId !== "string" || userId.length === 0) {
        skipped++;
        continue;
      }

      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
      if (authError) {
        console.error("[Cron: Weekly Digest] Failed to resolve user email:", authError.message);
        skipped++;
        continue;
      }

      const email = authUser?.user?.email;
      if (!email) {
        skipped++;
        continue;
      }

      const result = await sendWeeklyDigestEmail(
        email,
        user.username || "AuraMinter",
        i + 1, // rank
        Number(user.total_aura) || 0,
        top5
      );

      if (result.success) sent++;
      else {
        failed++;
        console.error("[Cron: Weekly Digest] Email failed:", result.error);
      }

      // Rate limit: 1 email per 100ms
      await new Promise((r) => setTimeout(r, SEND_INTERVAL_MS));
    }

    return NextResponse.json({ message: "Weekly digest sent", sent, failed, skipped });
  } catch (err) {
    console.error("[Cron: Weekly Digest]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
