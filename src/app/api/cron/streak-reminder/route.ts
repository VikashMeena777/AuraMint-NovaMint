import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendStreakReminderEmail } from "@/lib/email/send";

/**
 * Cron: Streak Reminder (runs at 8 PM IST daily)
 * Sends "your streak is about to break" emails to users who haven't logged today.
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

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  try {
    // Get users with active streaks (2+ days)
    const { data: streakUsers } = await supabase
      .from("profiles")
      .select("id, username, streak_days")
      .gte("streak_days", 2);

    if (!streakUsers || streakUsers.length === 0) {
      return NextResponse.json({ message: "No streaks at risk", sent: 0 });
    }

    let sent = 0;

    for (const user of streakUsers) {
      // Check if they already logged today
      const { count } = await supabase
        .from("aura_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", (user as any).id)
        .gte("created_at", todayStart.toISOString());

      if ((count || 0) > 0) continue; // Already logged today

      // Get email
      const { data: authUser } = await supabase.auth.admin.getUserById((user as any).id);
      const email = authUser?.user?.email;
      if (!email) continue;

      await sendStreakReminderEmail(email, (user as any).username || "AuraMinter", (user as any).streak_days || 2);
      sent++;
    }

    return NextResponse.json({ message: "Streak reminders sent", sent });
  } catch (err) {
    console.error("[Cron: Streak Reminder]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
