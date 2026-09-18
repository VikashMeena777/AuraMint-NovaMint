import { createClient } from "@/lib/supabase/server";
import { isSafeId, sanitizePlainText } from "@/lib/actions/safety";

/**
 * Activity logger for the audit trail (`activity_log` table).
 *
 * Contract:
 * - Never throws; callers may `await` it or use `.catch(() => {})`.
 * - `userId` must always come from the authenticated session, never from client input.
 * - Errors from Supabase are returned in the result object (not thrown), so they are
 *   checked and logged here.
 */

const ACTION_MAX_LENGTH = 120;
const MAX_METADATA_CHARS = 2000;

/** Keeps only a JSON-serialisable, size-bounded object for the metadata column. */
function boundMetadata(metadata?: Record<string, unknown>): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object") return {};
  try {
    const json = JSON.stringify(metadata);
    if (typeof json !== "string") return {};
    if (json.length > MAX_METADATA_CHARS) return { truncated: true };
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

export async function logActivity(
  userId: string,
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    if (!isSafeId(userId)) {
      console.warn("[logActivity] Refusing to log with an invalid user id");
      return;
    }

    const safeAction = sanitizePlainText(action, ACTION_MAX_LENGTH);
    if (!safeAction) {
      console.warn("[logActivity] Refusing to log an empty action");
      return;
    }

    const supabase = await createClient();
    const { error } = await supabase.from("activity_log").insert({
      user_id: userId,
      action: safeAction,
      metadata: boundMetadata(metadata),
    });

    if (error) {
      console.error("[logActivity] Insert failed:", safeAction, error.message);
    }
  } catch (err) {
    // e.g. called outside a request scope, where cookies() is unavailable.
    console.error("[logActivity] Failed:", action, err);
  }
}
