import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendDailyReportEmail } from "@/lib/email/send";

/**
 * Cron: Daily Aura Report (runs at 9 PM IST daily)
 * Sends personalized aura summary emails to all users who logged events today.
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
    // Get all users who logged events today
    const { data: todayEvents } = await supabase
      .from("aura_events")
      .select("user_id, description, aura_points, emoji")
      .gte("created_at", todayStart.toISOString());

    if (!todayEvents || todayEvents.length === 0) {
      return NextResponse.json({ message: "No events today", sent: 0 });
    }

    // Group by user
    const userEvents = new Map<string, typeof todayEvents>();
    for (const event of todayEvents) {
      const existing = userEvents.get((event as any).user_id) || [];
      existing.push(event);
      userEvents.set((event as any).user_id, existing);
    }

    let sent = 0;

    for (const [userId, events] of userEvents) {
      // Get user profile + email
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, total_aura, streak_days, tier")
        .eq("id", userId)
        .single();

      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      const email = authUser?.user?.email;

      if (!email || !profile) continue;

      const totalAura = events.reduce((sum, e) => sum + ((e as any).aura_points || 0), 0);
      const sorted = [...events].sort((a, b) => ((b as any).aura_points || 0) - ((a as any).aura_points || 0));
      const biggestW = sorted[0] && (sorted[0] as any).aura_points > 0 ? sorted[0] : null;
      const biggestL = sorted[sorted.length - 1] && (sorted[sorted.length - 1] as any).aura_points < 0 ? sorted[sorted.length - 1] : null;

      const vibes = ["Main Character Energy", "Sigma Grindset", "NPC Moment", "Villain Arc", "Wholesome", "Chaos Mode", "Chill Vibes"];
      const vibeOfTheDay = totalAura > 100 ? vibes[0] : totalAura > 0 ? vibes[1] : totalAura > -50 ? vibes[6] : vibes[3];

      await sendDailyReportEmail(email, (profile as any).username || "AuraMinter", {
        totalEvents: events.length,
        totalAura,
        biggestW: biggestW ? { description: (biggestW as any).description, points: (biggestW as any).aura_points, emoji: (biggestW as any).emoji || "⚡" } : null,
        biggestL: biggestL ? { description: (biggestL as any).description, points: (biggestL as any).aura_points, emoji: (biggestL as any).emoji || "💀" } : null,
        vibeOfTheDay,
        streakDays: (profile as any).streak_days || 0,
        tier: (profile as any).tier || "NPC",
      });

      sent++;
    }

    return NextResponse.json({ message: "Daily reports sent", sent });
  } catch (err) {
    console.error("[Cron: Daily Report]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
