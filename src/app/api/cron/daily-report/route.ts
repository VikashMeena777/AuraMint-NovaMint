import { NextRequest, NextResponse } from "next/server";
import { assertCronRequest } from "@/lib/supabase/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendDailyReportEmail } from "@/lib/email/send";
import { sanitizePlainText, truncateCodePoints } from "@/lib/actions/safety";

/**
 * Cron: Daily Aura Report (runs at 9 PM IST daily)
 * Sends personalized aura summary emails to all users who logged events today.
 */

// Reads request headers + service-role data and sends email: never cache, always Node.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/** Hard cap so a single run can never fan out to an unbounded recipient list. */
const MAX_RECIPIENTS = 500;

type EventRow = {
  user_id?: string | null;
  description?: string | null;
  aura_points?: number | null;
  emoji?: string | null;
  ai_emoji?: string | null;
};

export async function GET(req: NextRequest) {
  const unauthorized = assertCronRequest(req);
  if (unauthorized) return unauthorized;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[Cron: Daily Report] Supabase service-role environment is not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 503 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  try {
    // Get all users who logged events today
    const { data: todayEvents, error: eventsError } = await supabase
      .from("aura_events")
      .select("*")
      .gte("created_at", todayStart.toISOString());

    if (eventsError) {
      console.error("[Cron: Daily Report] Failed to load today's events:", eventsError.message);
      return NextResponse.json({ error: "Failed" }, { status: 500 });
    }

    if (!todayEvents || todayEvents.length === 0) {
      return NextResponse.json({ message: "No events today", sent: 0 });
    }

    // Group by user
    const userEvents = new Map<string, EventRow[]>();
    for (const raw of todayEvents as EventRow[]) {
      const userId = raw?.user_id;
      if (typeof userId !== "string" || userId.length === 0) continue;
      const existing = userEvents.get(userId) || [];
      existing.push(raw);
      userEvents.set(userId, existing);
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let processed = 0;

    for (const [userId, events] of userEvents) {
      if (processed >= MAX_RECIPIENTS) {
        console.warn(
          `[Cron: Daily Report] Recipient cap reached (${MAX_RECIPIENTS}); ${userEvents.size - processed} users skipped`
        );
        break;
      }
      processed++;

      // `select("*")` deliberately avoids naming a possibly-renamed tier column; the
      // previous `tier` select silently failed for the whole query if it was absent.
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
      if (authError) {
        console.error("[Cron: Daily Report] Failed to resolve user email:", authError.message);
        skipped++;
        continue;
      }

      const email = authUser?.user?.email;
      if (!email || !profile) {
        skipped++;
        continue;
      }

      const profileRow = profile as Record<string, unknown>;
      const totalAura = events.reduce((sum, e) => sum + (Number(e.aura_points) || 0), 0);
      const sorted = [...events].sort(
        (a, b) => (Number(b.aura_points) || 0) - (Number(a.aura_points) || 0)
      );
      const biggestW =
        sorted[0] && (Number(sorted[0].aura_points) || 0) > 0 ? sorted[0] : null;
      const biggestL =
        sorted[sorted.length - 1] && (Number(sorted[sorted.length - 1].aura_points) || 0) < 0
          ? sorted[sorted.length - 1]
          : null;

      const vibes = ["Main Character Energy", "Sigma Grindset", "NPC Moment", "Villain Arc", "Wholesome", "Chaos Mode", "Chill Vibes"];
      const vibeOfTheDay = totalAura > 100 ? vibes[0] : totalAura > 0 ? vibes[1] : totalAura > -50 ? vibes[6] : vibes[3];

      const result = await sendDailyReportEmail(
        email,
        String(profileRow.username || "AuraMinter"),
        {
          totalEvents: events.length,
          totalAura,
          biggestW: biggestW
            ? {
                description: sanitizePlainText(biggestW.description, 280),
                points: Number(biggestW.aura_points) || 0,
                emoji: truncateCodePoints(biggestW.emoji || biggestW.ai_emoji || "⚡", 4) || "⚡",
              }
            : null,
          biggestL: biggestL
            ? {
                description: sanitizePlainText(biggestL.description, 280),
                points: Number(biggestL.aura_points) || 0,
                emoji: truncateCodePoints(biggestL.emoji || biggestL.ai_emoji || "💀", 4) || "💀",
              }
            : null,
          vibeOfTheDay,
          streakDays: Number(profileRow.streak_days) || 0,
          tier: String(profileRow.current_tier || profileRow.tier || "NPC"),
        }
      );

      if (result.success) sent++;
      else {
        failed++;
        console.error("[Cron: Daily Report] Email failed:", result.error);
      }
    }

    return NextResponse.json({ message: "Daily reports sent", sent, failed, skipped });
  } catch (err) {
    console.error("[Cron: Daily Report]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
