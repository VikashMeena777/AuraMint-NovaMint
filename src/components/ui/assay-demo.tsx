"use client";

import * as React from "react";
import { Loader2, RotateCcw, Stamp } from "lucide-react";

import { cn } from "@/lib/utils";
import { AnimatedIcon } from "@/components/ui/animated-icon";
import { AuraNumber } from "@/components/ui/aura-number";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import {
  Receipt,
  ReceiptBarcode,
  ReceiptGuilloche,
  ReceiptRow,
  ReceiptRule,
  ReceiptSerial,
  ReceiptTotal,
} from "@/components/ui/receipt";

/**
 * The landing assay: describe a moment, strike a verdict, get a receipt.
 *
 * HONESTY NOTE (important): this marketing demo scores LOCALLY from the fixed
 * rule table below plus a deterministic fallback hash. It is not the product's
 * AI. The receipt says so on its face, and the copy points at the real thing
 * rather than implying a model ran. Nothing here is `Math.random()` and nothing
 * is computed during render, so server HTML and client HTML always agree.
 */

const STAGES = [
  "Reading the moment…",
  "Weighing it against the ledger…",
  "Striking the figure…",
] as const;

type Verdict = {
  points: number;
  emoji: string;
  tag: string;
  verdict: string;
  category: string;
};

const RULES: { keywords: string[]; result: Verdict }[] = [
  {
    keywords: ["paid", "bill", "treat", "everyone", "split"],
    result: {
      points: 2500,
      emoji: "🧾",
      tag: "Aura Rich Flex",
      verdict:
        "Paisa hi paisa. You picked up the bill without being asked — main character behaviour, and the group chat noticed.",
      category: "Social / Friends",
    },
  },
  {
    keywords: ["gym", "lift", "workout", "ran", "run", "6 am", "morning"],
    result: {
      points: 1500,
      emoji: "🏋️",
      tag: "Gym Arc Active",
      verdict:
        "Consistent effort, fr fr. The 6 AM crowd has accepted you; the rest of us are still in bed and slightly ashamed.",
      category: "Gym / Fitness",
    },
  },
  {
    keywords: ["left on read", "read at", "ignored", "no reply", "ghosted"],
    result: {
      points: -1200,
      emoji: "📵",
      tag: "Social Sin",
      verdict:
        "Left on read for four hours is not a personality. Attitude bohot hai, and the ledger does not forget.",
      category: "Crush / Dating",
    },
  },
  {
    keywords: ["sunglasses", "indoors", "shades inside", "inside the metro"],
    result: {
      points: -900,
      emoji: "🕶️",
      tag: "Cringe Alert",
      verdict:
        "Shades indoors is a bold choice with zero payoff. You are squinting at your own reflection in the lift buttons.",
      category: "Random / Misc",
    },
  },
  {
    keywords: ["promotion", "topper", "aced", "rank", "selected", "cleared"],
    result: {
      points: 8000,
      emoji: "🏆",
      tag: "Legendary W",
      verdict:
        "Kya baat hai! This is the kind of entry people screenshot. The literal plot of your semester just changed.",
      category: "Work / Hustle",
    },
  },
  {
    keywords: ["presentation", "voice cracked", "mic", "muted", "stage"],
    result: {
      points: -3500,
      emoji: "🎤",
      tag: "Public Execution",
      verdict:
        "Sabke saamne? The room went quiet, the projector hummed, and your voice chose violence. Character building, technically.",
      category: "School / College",
    },
  },
  {
    keywords: ["mummy", "mom", "papa", "dad", "family", "ghar"],
    result: {
      points: 2200,
      emoji: "🫖",
      tag: "Ghar Ka Hero",
      verdict:
        "Caring for family is the quiet W that actually compounds. Sharma ji ka beta could never.",
      category: "Family",
    },
  },
];

const FALLBACK_POSITIVE = [
  { emoji: "⚡", tag: "W Move", verdict: "Small, deliberate, and unbothered. This is how a decent day is built." },
  { emoji: "🔥", tag: "Iconic Energy", verdict: "The plot moved. Modest moment, permanent aura." },
  { emoji: "🗿", tag: "Based Decision", verdict: "You understood the assignment and delivered it without drama." },
];

const FALLBACK_NEGATIVE = [
  { emoji: "💀", tag: "NPC Arc", verdict: "Ouch. That one left a mark on the ledger and on your reputation." },
  { emoji: "😬", tag: "Down Bad", verdict: "Some moments should stay in drafts. This was one of them." },
  { emoji: "🪨", tag: "Cope Entry", verdict: "The council has reviewed your submission and gently declined it." },
];

/** Deterministic hash — no randomness, so the same moment always assays the same. */
function hash(value: string): number {
  let out = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    out ^= value.charCodeAt(index);
    out = Math.imul(out, 16777619);
  }
  return Math.abs(out);
}

function assay(input: string): Verdict {
  const normalised = input.trim().toLowerCase();
  const matched = RULES.find((rule) =>
    rule.keywords.some((keyword) => normalised.includes(keyword))
  );
  if (matched) return matched.result;

  const seed = hash(normalised || "auramint");
  const isPositive = seed % 2 === 0;
  const table = isPositive ? FALLBACK_POSITIVE : FALLBACK_NEGATIVE;
  const pick = table[seed % table.length];
  const magnitude = 400 + (seed % 2600);
  return {
    points: isPositive ? magnitude : -magnitude,
    emoji: pick.emoji,
    tag: pick.tag,
    verdict: pick.verdict,
    category: "Random / Misc",
  };
}

function serialFor(input: string, stamp: number): string {
  const digits = (hash(`${input}:${stamp}`) % 9000000) + 1000000;
  return `#${digits.toString().padStart(8, "0")}`;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Struck = Verdict & { serial: string; mintedAt: string; moment: string };

export function AssayDemo({ className }: { className?: string }) {
  const [moment, setMoment] = React.useState("");
  const [stage, setStage] = React.useState<string | null>(null);
  const [struck, setStruck] = React.useState<Struck | null>(null);
  const [strikeCount, setStrikeCount] = React.useState(0);

  const working = stage !== null;
  const canStrike = moment.trim().length >= 3 && !working;

  async function handleStrike(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canStrike) return;

    setStage(STAGES[0]);
    for (const next of STAGES) {
      setStage(next);
      await wait(420);
    }

    const result = assay(moment);
    const stamp = strikeCount + 1;
    setStrikeCount(stamp);
    setStruck({
      ...result,
      serial: serialFor(moment, stamp),
      mintedAt: new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      moment: moment.trim(),
    });
    setStage(null);
  }

  function handleReset() {
    setMoment("");
    setStruck(null);
    setStage(null);
  }

  return (
    <div className={cn("grid gap-5 lg:grid-cols-2 lg:gap-8", className)}>
      {/* ── Left: the moment ─────────────────────────────────────────── */}
      <form onSubmit={handleStrike} className="plate flex flex-col gap-4 p-5 sm:p-6" noValidate>
        <div>
          <h3 className="heading text-[20px]">Deposit a moment</h3>
          <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
            One line is enough. The more specific you are, the sharper the verdict.
          </p>
        </div>

        <Field
          label="What happened?"
          id="assay-moment"
          description="Up to 280 characters. Examples: the bill you paid, the chat you left, the gym you actually attended."
        >
          {(field) => (
            <Textarea
              {...field}
              value={moment}
              onChange={(event) => setMoment(event.target.value.slice(0, 280))}
              maxLength={280}
              rows={5}
              placeholder="Paid for everyone's chai and nobody said thank you…"
            />
          )}
        </Field>

        <div className="flex items-center justify-between gap-3">
          <span className="mono text-[12px] text-[hsl(var(--muted-foreground))]">
            {moment.length}/280
          </span>
          <div className="flex items-center gap-2">
            {struck ? (
              <Button type="button" variant="quiet" size="sm" onClick={handleReset}>
                <AnimatedIcon icon={RotateCcw} idiom="press" className="size-4" />
                Clear
              </Button>
            ) : null}
            <Button type="submit" variant="strike" size="md" disabled={!canStrike}>
              {working ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Striking…
                </>
              ) : (
                <>
                  <AnimatedIcon icon={Stamp} idiom="press" className="size-4" />
                  Strike the verdict
                </>
              )}
            </Button>
          </div>
        </div>

        <p aria-live="polite" role="status" className="min-h-5 text-[13px] text-[hsl(var(--muted-foreground))]">
          {stage ?? ""}
        </p>

        <p className="border-t border-[hsl(var(--border))] pt-4 text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          This demo scores locally from a fixed rule table — it is a taste of the phrasing, not the
          model. Signed-in entries get a live AI verdict, a serial and a permanent ledger row.
        </p>
      </form>

      {/* ── Right: the receipt ───────────────────────────────────────── */}
      <div className="relative flex flex-col">
        {/* The overprint is stamped on after the verdict lands — one finite
            gesture per press, and invisible under reduced motion (the class is
            neutralised by the global reduced-motion block, which leaves it
            fully opaque rather than animating it in). */}
        {struck ? (
          <span
            aria-hidden="true"
            className="label-micro animate-plate-in absolute right-4 top-4 z-10 -rotate-[3deg] rounded-[var(--radius-sm)] border border-[var(--brass-600)] px-2 py-0.5 text-[var(--brass-600)]"
          >
            Struck
          </span>
        ) : null}

        <Receipt key={strikeCount} className={struck ? "animate-strike" : undefined}>
          <ReceiptGuilloche className="-mx-5 -mt-5 mb-4 sm:-mx-6" />

          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label-micro">Assay receipt</p>
              <p className="heading mt-1 text-[20px] leading-tight">
                {struck ? "Verdict struck" : "Awaiting deposit"}
              </p>
            </div>
            <span aria-hidden="true" className="text-[28px] leading-none">
              {struck ? struck.emoji : "🗿"}
            </span>
          </div>

          <ReceiptRule className={struck ? "animate-settle" : undefined} />

          {struck ? (
            <div className="flex flex-col gap-3">
              <div>
                <p className="label-micro">Moment</p>
                <p className="mt-1 text-[14px] leading-relaxed">&ldquo;{struck.moment}&rdquo;</p>
              </div>

              <div>
                <p className="label-micro">Verdict</p>
                <p className="mt-1 font-display text-[16px] italic leading-relaxed">
                  {struck.verdict}
                </p>
              </div>

              <ReceiptRule className="my-1" />

              <ReceiptRow label="Vibe tag" value={struck.tag} />
              <ReceiptRow label="Category" value={struck.category} />
              <ReceiptRow
                label="Direction"
                value={struck.points >= 0 ? "Credit" : "Debit"}
                hint={
                  struck.points >= 0
                    ? "Positive aura — patina ink in the ledger."
                    : "Negative aura — oxide ink in the ledger."
                }
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2 py-2">
              <p className="text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                Nothing struck yet. Describe a moment on the left and the receipt will print here:
                verdict, vibe tag, direction and serial number.
              </p>
              <ReceiptRow label="Sample — gym at 6 AM" value="+1,500" />
              <ReceiptRow label="Sample — left on read" value="−1,200" />
            </div>
          )}

          <ReceiptRule />

          <ReceiptTotal label="Aura">
            <AuraNumber
              value={struck ? struck.points : 0}
              size="display"
              animateOnChange={Boolean(struck)}
            />
          </ReceiptTotal>

          <div className="mt-5 flex items-end justify-between gap-4">
            <ReceiptBarcode serial={struck ? struck.serial : "auramint-demo"} />
            <ReceiptSerial
              serial={struck ? struck.serial : "#————"}
              timestamp={struck ? `minted ${struck.mintedAt}` : undefined}
            />
          </div>
        </Receipt>
      </div>
    </div>
  );
}
