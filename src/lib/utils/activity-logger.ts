import { createClient } from "@/lib/supabase/server";

/**
 * Fire-and-forget activity logger.
 * Logs user actions to the activity_log table for audit trail.
 * NEVER await this in request paths — use .catch(() => {}).
 */
export async function logActivity(
  userId: string,
  action: string,
  metadata?: Record<string, unknown>
) {
  try {
    const supabase = await createClient();
    await supabase.from("activity_log").insert({
      user_id: userId,
      action,
      metadata: metadata || {},
    });
  } catch (err) {
    console.error("[logActivity] Failed:", action, err);
  }
}
