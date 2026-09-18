/**
 * Aura scoring.
 *
 * This module is an internal server helper — it deliberately has NO "use server"
 * directive. A "use server" file would expose `calculateAura` as a publicly callable
 * endpoint, letting anyone burn the AI budget (and the free-tier daily limit is
 * enforced in the action, not here).
 */

import { getNimClient } from "./nim-client";
import {
  AURA_SYSTEM_PROMPT,
  buildAuraUserPrompt,
  type AuraResult,
} from "./prompts";
import { coerceAuraResult, DEFAULT_EMOJI, DEFAULT_VERDICT, DEFAULT_VIBE_TAG } from "./aura-output";

const NIM_MODEL = "meta/llama-3.1-8b-instruct";

const FALLBACK_POINTS_CAP = 5000;

/**
 * Calculate aura points for a given life event using NVIDIA NIM.
 * Falls back to rules-based scoring if the API fails or returns unusable output.
 */
export async function calculateAura(description: string, category: string): Promise<AuraResult> {
  try {
    const client = getNimClient();
    if (!client) {
      return fallbackCalculation(description);
    }

    const response = await client.chat.completions.create({
      model: NIM_MODEL,
      messages: [
        { role: "system", content: AURA_SYSTEM_PROMPT },
        { role: "user", content: buildAuraUserPrompt(description, category) },
      ],
      max_tokens: 256,
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return fallbackCalculation(description);
    }

    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch {
      console.warn("[AuraCalculator] Model returned non-JSON output; using fallback");
      return fallbackCalculation(description);
    }

    // Validate + sanitise every field the model produced before it can be stored.
    const coerced = coerceAuraResult(raw);
    if (!coerced) {
      console.warn("[AuraCalculator] Model output failed validation; using fallback");
      return fallbackCalculation(description);
    }

    return coerced;
  } catch (error) {
    console.error("[AuraCalculator] NIM API error:", error);
    return fallbackCalculation(description);
  }
}

/** Word-boundary patterns — substring matching gave free +500 for any "w" character. */
const POSITIVE_PATTERNS: readonly RegExp[] = [
  /\bwon\b/,
  /\bwin\b/,
  /\bpassed\b/,
  /\baced\b/,
  /\bcrush\b/,
  /\bpromoted\b/,
  /\bpromotion\b/,
  /\binvited\b/,
  /\bcomplimented\b/,
  /\bslay\b/,
  /\bslayed\b/,
  /\bw\b/,
  /\bearned\b/,
  /\bachieved\b/,
  /\bconfident\b/,
];

const NEGATIVE_PATTERNS: readonly RegExp[] = [
  /\btripped\b/,
  /\bfell\b/,
  /\brejected\b/,
  /\bfailed\b/,
  /\bembarrassed\b/,
  /\bcaught\b/,
  /\bforgot\b/,
  /\blost\b/,
  /\bspilled\b/,
  /\bcracked\b/,
  /\bfired\b/,
  /\bghosted\b/,
  /left on read/,
];

/**
 * Fallback rules-based calculation when the AI is unavailable.
 * Exported for regression tests.
 */
export function fallbackCalculation(description: string): AuraResult {
  const desc = String(description ?? "").toLowerCase();

  let score = 0;
  for (const pattern of POSITIVE_PATTERNS) {
    if (pattern.test(desc)) score += 500;
  }
  for (const pattern of NEGATIVE_PATTERNS) {
    if (pattern.test(desc)) score -= 500;
  }

  // Random variance
  score += Math.floor(Math.random() * 200) - 100;

  // Clamp
  score = Math.max(-FALLBACK_POINTS_CAP, Math.min(FALLBACK_POINTS_CAP, score));
  if (score === 0) score = Math.random() > 0.5 ? 200 : -200;

  const verdicts = {
    positive: [
      "Kya baat hai! Main character energy detected fr fr 👑",
      "W move bhai, aura stonks going UP 📈",
      "Arre wah! Sigma behavior no cap ✨",
      "This is giving protagonist energy, keep going yaar 🔥",
    ],
    negative: [
      "Bruh. NPC behavior detected. Bas kar bhai 💀",
      "Tera toh hogaya yaar... catastrophic L incoming 😬",
      "This is NOT the main character arc you wanted bhai 🗿",
      "Bro really said 'let me tank my aura real quick' 💀",
    ],
    neutral: [
      "Meh. Not an L, not a W. Just... existing 🗿",
      "Civilian energy. Nothing to see here yaar 😐",
    ],
  } as const;

  const vibes = {
    positive: ["Main Character Energy", "W Factory Output", "Sigma Grindset", "Based Department Called"],
    negative: ["NPC Behavior", "L Magnet Energy", "Cope Arc Central", "Villain Origin Story"],
    neutral: ["Background Character", "Spectator Mode", "NPC Vibes"],
  } as const;

  const type: keyof typeof verdicts = score > 200 ? "positive" : score < -200 ? "negative" : "neutral";
  const verdict = verdicts[type][Math.floor(Math.random() * verdicts[type].length)] ?? DEFAULT_VERDICT;
  const vibe_tag = vibes[type][Math.floor(Math.random() * vibes[type].length)] ?? DEFAULT_VIBE_TAG;
  const emoji = type === "positive" ? "✨" : type === "negative" ? "💀" : "🗿";

  return { points: score, verdict, vibe_tag, emoji: emoji || DEFAULT_EMOJI };
}
