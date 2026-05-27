"use server";

import { nimClient } from "./nim-client";
import { AURA_SYSTEM_PROMPT, type AuraResult } from "./prompts";

const NIM_MODEL = "meta/llama-3.1-8b-instruct";

/**
 * Calculate aura points for a given life event using NVIDIA NIM.
 * Falls back to rules-based scoring if API fails.
 */
export async function calculateAura(
  description: string,
  category: string
): Promise<AuraResult> {
  try {
    if (!process.env.NVIDIA_NIM_API_KEY) {
      return fallbackCalculation(description, category);
    }

    const response = await nimClient.chat.completions.create({
      model: NIM_MODEL,
      messages: [
        { role: "system", content: AURA_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Category: ${category}\nEvent: "${description}"\n\nRate this moment's aura impact. Respond with JSON only.`,
        },
      ],
      max_tokens: 256,
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return fallbackCalculation(description, category);
    }

    const parsed = JSON.parse(content) as AuraResult;

    // Validate and clamp
    return {
      points: Math.max(-10000, Math.min(10000, Math.round(parsed.points || 0))),
      verdict: parsed.verdict || "No words. Just vibes. 🗿",
      vibe_tag: parsed.vibe_tag || "Mystery Energy",
      emoji: parsed.emoji || "✨",
    };
  } catch (error) {
    console.error("[AuraCalculator] NIM API error:", error);
    return fallbackCalculation(description, category);
  }
}

/**
 * Fallback rules-based calculation when AI is unavailable.
 */
function fallbackCalculation(description: string, category: string): AuraResult {
  const desc = description.toLowerCase();

  // Positive signals
  const positiveWords = ["won", "passed", "aced", "crush", "promoted", "invited", "complimented", "slay", "W", "got", "earned", "achieved", "confident"];
  const negativeWords = ["tripped", "fell", "rejected", "failed", "embarrassed", "caught", "forgot", "lost", "spilled", "cracked", "fired", "ghosted", "left on read"];

  let score = 0;
  let posCount = 0;
  let negCount = 0;

  for (const word of positiveWords) {
    if (desc.includes(word)) { score += 500; posCount++; }
  }
  for (const word of negativeWords) {
    if (desc.includes(word)) { score -= 500; negCount++; }
  }

  // Random variance
  score += Math.floor(Math.random() * 200) - 100;

  // Clamp
  score = Math.max(-5000, Math.min(5000, score));
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
  };

  const vibes = {
    positive: ["Main Character Energy", "W Factory Output", "Sigma Grindset", "Based Department Called"],
    negative: ["NPC Behavior", "L Magnet Energy", "Cope Arc Central", "Villain Origin Story"],
    neutral: ["Background Character", "Spectator Mode", "NPC Vibes"],
  };

  const type = score > 200 ? "positive" : score < -200 ? "negative" : "neutral";
  const verdict = verdicts[type][Math.floor(Math.random() * verdicts[type].length)];
  const vibe_tag = vibes[type][Math.floor(Math.random() * vibes[type].length)];
  const emoji = type === "positive" ? "✨" : type === "negative" ? "💀" : "🗿";

  return { points: score, verdict, vibe_tag, emoji };
}
