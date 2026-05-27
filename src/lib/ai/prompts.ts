export const AURA_SYSTEM_PROMPT = `You are the AuraMint AI — the most dramatic, savage, and entertaining aura points calculator on the internet. You rate life moments with aura points and deliver devastating/hilarious verdicts.

RULES:
1. You MUST respond ONLY with valid JSON. No markdown, no extra text.
2. Aura points range: -10000 to +10000
3. Be DRAMATIC. A small win = huge celebration. A small L = devastating roast.
4. Mix English and Hinglish (Hindi-English) naturally in verdicts. Use Hindi words like "bhai", "yaar", "arre", "kya baat hai", "tera toh hogaya", "bas kar bhai" etc. when it fits the vibe.
5. Use Gen-Z slang: "no cap", "fr fr", "W", "L", "bussin", "slay", "main character", "NPC", "sigma", "based", "bruh moment"
6. Reference Indian culture when relevant: "aunty vibes", "sharma ji ka beta", "JEE aspirant energy", "chai > coffee", etc.
7. Verdicts should be 1-2 sentences MAX. Punchy, quotable, screenshot-worthy.
8. Vibe tags must be creative and fun.

RESPONSE FORMAT (strict JSON):
{
  "points": <number between -10000 and 10000>,
  "verdict": "<savage 1-2 sentence verdict mixing English/Hinglish>",
  "vibe_tag": "<creative 2-4 word vibe tag>",
  "emoji": "<single emoji that best represents this moment>"
}

AURA SCORING GUIDE:
- Legendary W (got promotion, crush said yes, aced exam): +5000 to +10000
- Big W (good social moment, achieved something): +1000 to +4999
- Small W (minor positive moment): +100 to +999
- Neutral (meh moment): -99 to +99
- Small L (minor embarrassment): -100 to -999
- Big L (public embarrassment, got rejected): -1000 to -4999
- Catastrophic L (life-altering embarrassment): -5000 to -10000

VIBE TAG EXAMPLES:
"Main Character Energy", "NPC Behavior", "Sigma Grindset", "Villain Origin Story", "Rom-Com Protagonist", "Anime Protagonist Arc", "Cope Arc Central", "Therapy Arc Needed", "Based Department Called", "W Factory Output", "L Magnet Energy", "Chai Over Coffee Energy", "Sharma Ji Ka Beta", "Unhinged Excellence"`;

export const AURA_TIERS = [
  { name: "Negative Aura", min: -Infinity, max: -1, emoji: "💀", color: "#EF4444", description: "You radiate anti-energy" },
  { name: "NPC", min: 0, max: 4999, emoji: "🗿", color: "#6B7280", description: "Background character energy" },
  { name: "Civilian", min: 5000, max: 24999, emoji: "😐", color: "#8B5CF6", description: "You exist, barely noticed" },
  { name: "Rising Star", min: 25000, max: 99999, emoji: "⭐", color: "#3B82F6", description: "People are starting to notice" },
  { name: "Main Character", min: 100000, max: 499999, emoji: "🔥", color: "#F59E0B", description: "The plot revolves around you" },
  { name: "Legendary", min: 500000, max: 999999, emoji: "👑", color: "#FFD700", description: "Songs will be written about you" },
  { name: "Mythical", min: 1000000, max: 4999999, emoji: "⚡", color: "#8B5CF6", description: "Mere mortals tremble" },
  { name: "GOD MODE", min: 5000000, max: Infinity, emoji: "🌟", color: "#FFD700", description: "You ARE the universe" },
] as const;

export const CATEGORIES = [
  { value: "crush", label: "Crush / Dating", emoji: "💕" },
  { value: "school", label: "School / College", emoji: "🎓" },
  { value: "work", label: "Work / Hustle", emoji: "💼" },
  { value: "gym", label: "Gym / Fitness", emoji: "💪" },
  { value: "social", label: "Social / Friends", emoji: "🎉" },
  { value: "family", label: "Family", emoji: "🏠" },
  { value: "random", label: "Random / Misc", emoji: "🎲" },
] as const;

export type AuraResult = {
  points: number;
  verdict: string;
  vibe_tag: string;
  emoji: string;
};

export type AuraTier = (typeof AURA_TIERS)[number];
export type Category = (typeof CATEGORIES)[number];

export function getTierForAura(totalAura: number): AuraTier {
  for (let i = AURA_TIERS.length - 1; i >= 0; i--) {
    if (totalAura >= AURA_TIERS[i].min) {
      return AURA_TIERS[i];
    }
  }
  return AURA_TIERS[0];
}

export function getTierProgress(totalAura: number): { current: AuraTier; next: AuraTier | null; progress: number; remaining: number } {
  const current = getTierForAura(totalAura);
  const currentIndex = AURA_TIERS.indexOf(current);
  const next = currentIndex < AURA_TIERS.length - 1 ? AURA_TIERS[currentIndex + 1] : null;

  if (!next) {
    return { current, next: null, progress: 100, remaining: 0 };
  }

  const rangeSize = next.min - current.min;
  const userProgress = totalAura - current.min;
  const progress = Math.min(100, Math.max(0, (userProgress / rangeSize) * 100));
  const remaining = next.min - totalAura;

  return { current, next, progress, remaining };
}
