/**
 * Read-side aggregates for the public feed.
 *
 * The feed rows themselves only carry `upvotes`/`downvotes` (recomputed from `votes`
 * after each mutation). Reaction counts and the *viewer's own* vote/reaction live in
 * the `votes` / `reactions` tables and must be aggregated on read — there is no
 * `reaction_counts` column maintained by the backend.
 *
 * These helpers are pure and dependency-light so they can be unit tested directly;
 * the Supabase queries happen in `getPublicFeed`, which feeds raw rows in here.
 *
 * NOT a "use server" module (it exports non-async helpers).
 */

import { isReactionType, type ReactionType, type VoteValue } from "@/lib/actions/safety";

/** `{ crown: 3, fire: 1 }` — only allowlisted reaction types ever appear. */
export type ReactionCountMap = Partial<Record<ReactionType, number>>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function readEventId(row: Record<string, unknown>): string | null {
  const id = row.event_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * Counts reactions per event.
 *
 * Only the allowlisted `REACTION_TYPES` are counted: a legacy/forged type in the
 * table can never create a new chip in the UI or inflate a known one.
 */
export function aggregateReactionCounts(rows: unknown): Map<string, ReactionCountMap> {
  const out = new Map<string, ReactionCountMap>();
  if (!Array.isArray(rows)) return out;

  for (const raw of rows) {
    const row = asRecord(raw);
    if (!row) continue;
    const eventId = readEventId(row);
    if (!eventId) continue;

    const type = row.type;
    if (!isReactionType(type)) continue;

    const bucket = out.get(eventId) ?? {};
    bucket[type] = (bucket[type] ?? 0) + 1;
    out.set(eventId, bucket);
  }

  return out;
}

/** Maps event id → the viewer's own vote (1 | -1). Invalid rows are ignored. */
export function indexViewerVotes(rows: unknown): Map<string, VoteValue> {
  const out = new Map<string, VoteValue>();
  if (!Array.isArray(rows)) return out;

  for (const raw of rows) {
    const row = asRecord(raw);
    if (!row) continue;
    const eventId = readEventId(row);
    if (!eventId) continue;

    const value = row.value;
    if (value === 1 || value === -1) out.set(eventId, value);
  }

  return out;
}

/** Maps event id → the viewer's own reaction type. Invalid rows are ignored. */
export function indexViewerReactions(rows: unknown): Map<string, ReactionType> {
  const out = new Map<string, ReactionType>();
  if (!Array.isArray(rows)) return out;

  for (const raw of rows) {
    const row = asRecord(raw);
    if (!row) continue;
    const eventId = readEventId(row);
    if (!eventId) continue;

    const type = row.type;
    if (isReactionType(type)) out.set(eventId, type);
  }

  return out;
}
