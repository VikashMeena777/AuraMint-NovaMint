/**
 * Coercion of untrusted model output into a safe `AuraResult`.
 *
 * The model is an untrusted component: its JSON can contain NaN-ish numbers,
 * arbitrary length strings, markup, or extra fields. Everything that reaches the
 * database or a rendered surface must pass through here.
 */

import { z } from "zod";
import { clampAuraPoints, sanitizePlainText, truncateCodePoints } from "@/lib/actions/safety";
import type { AuraResult } from "./prompts";

export const AURA_VERDICT_MAX = 300;
export const AURA_VIBE_TAG_MAX = 40;
export const AURA_EMOJI_MAX_CODEPOINTS = 4;

export const DEFAULT_VERDICT = "No words. Just vibes. 🗿";
export const DEFAULT_VIBE_TAG = "Mystery Energy";
export const DEFAULT_EMOJI = "✨";

const modelOutputSchema = z.object({
  points: z.union([z.number(), z.string(), z.null()]).optional(),
  verdict: z.unknown().optional(),
  vibe_tag: z.unknown().optional(),
  emoji: z.unknown().optional(),
});

/**
 * Validates + sanitises a parsed model response.
 * Returns `null` when the payload is unusable (caller should fall back).
 */
export function coerceAuraResult(raw: unknown): AuraResult | null {
  const parsed = modelOutputSchema.safeParse(raw);
  if (!parsed.success) return null;

  const { points, verdict, vibe_tag, emoji } = parsed.data;

  // `clampAuraPoints` rejects NaN/Infinity and rounds into [-10000, 10000].
  const safePoints = clampAuraPoints(points);

  const safeVerdict = sanitizePlainText(verdict, AURA_VERDICT_MAX) || DEFAULT_VERDICT;
  const safeVibeTag = sanitizePlainText(vibe_tag, AURA_VIBE_TAG_MAX) || DEFAULT_VIBE_TAG;
  const safeEmoji =
    truncateCodePoints(sanitizePlainText(emoji, 32), AURA_EMOJI_MAX_CODEPOINTS) || DEFAULT_EMOJI;

  return {
    points: safePoints,
    verdict: safeVerdict,
    vibe_tag: safeVibeTag,
    emoji: safeEmoji,
  };
}
