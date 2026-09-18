import { NextRequest, NextResponse } from "next/server";
import { assertCronRequest } from "@/lib/supabase/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendStreakReminderEmail } from "@/lib/email/send";
import { sanitizePlainText } from "@/lib/actions/safety";

/**
 * Cron: Streak Reminder (runs at 8 PM IST daily)
 * Sends "your streak is about to break" emails to users who haven't logged today.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/** Hard cap so a single run can never fan out to an unbounded recipient list. */
const MAX_RECIPIENTS = 500;

type ProfileRow = {
  id?: string | null;
  username?: string | null;
  streak_days?: number | null;
};

export async function GET(req: NextRequest) {
  const unauthorized = assertCronRequest(req);
  if (unauthorized) return unauthorized;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[Cron: Streak Reminder] Supabase service-role environment is not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 503 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  try {
    // Get users with active streaks (2+ days)
    const { data: streakUsers, error: streakError } = await supabase
      .from("profiles")
      .select("id, username, streak_days")
      .gte("streak_days", 2);

    if (streakError) {
      console.error("[Cron: Streak Reminder] Failed to load streak users:", streakError.message);
      return NextResponse.json({ error: "Failed" }, { status: 500 });
    }

    if (!streakUsers || streakUsers.length === 0) {
      return NextResponse.json({ message: "No streaks at risk", sent: 0 });
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let processed = 0;

    for (const rawUser of streakUsers as ProfileRow[]) {
      if (processed >= MAX_RECIPIENTS) {
        console.warn(
          `[Cron: Streak Reminder] Recipient cap reached (${MAX_RECIPIENTS}); remaining users skipped`
        );
        break;
      }
      processed++;

      const userId = rawUser?.id;
      if (typeof userId !== "string" || userId.length === 0) {
        skipped++;
        continue;
      }

      // Check if they already logged today
      const { count, error: countError } = await supabase
        .from("aura_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", todayStart.toISOString());

      if (countError) {
        console.error("[Cron: Streak Reminder] Failed to count today's events:", countError.message);
        skipped++;
        continue;
      }

      if ((count || 0) > 0) continue; // Already logged today

      // Get email
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
      if (authError) {
        console.error("[Cron: Streak Reminder] Failed to resolve user email:", authError.message);
        skipped++;
        continue;
      }

      const email = authUser?.user?.email;
      if (!email) {
        skipped++;
        continue;
      }

      const streakDays = Math.max(2, Math.trunc(Number(rawUser.streak_days) || 2));
      const result = await sendStreakReminderEmail(
        email,
        sanitizePlainText(rawUser.username, 20) || "AuraMinter",
        streakDays
      );

      if (result.success) sent++;
      else {
        failed++;
        console.error("[Cron: Streak Reminder] Email failed:", result.error);
      }
    }

    return NextResponse.json({ message: "Streak reminders sent", sent, failed, skipped });
  } catch (err) {
    console.error("[Cron: Streak Reminder]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
