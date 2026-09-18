"use client";

import { BookOpenText, PenLine, Stamp, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { AnimatedIcon } from "@/components/ui/animated-icon";

/**
 * The three-step assay line — the product's mechanics in one row:
 * describe the moment, strike the verdict, keep the receipt in the ledger.
 *
 * A client island because the step marks animate on hover/focus; the icons are
 * declared here rather than passed in, since component references cannot cross
 * the server/client boundary.
 */
const steps: { Icon: LucideIcon; step: string; title: string; body: string }[] = [
  {
    Icon: PenLine,
    step: "01 · Describe",
    title: "Write the moment",
    body: "One line about what actually happened — the chai you paid for, the chat you ignored, the gym you attended. Up to five entries a day on the free plan.",
  },
  {
    Icon: Stamp,
    step: "02 · Strike",
    title: "Get it assayed",
    body: "The verdict comes back with an aura figure between −10,000 and +10,000, a vibe tag, and a line in Hinglish that you will want to screenshot.",
  },
  {
    Icon: BookOpenText,
    step: "03 · Ledger",
    title: "Keep the receipt",
    body: "Every entry is serial-numbered and filed against your running total, which decides your tier on the public ledger and the leaderboard.",
  },
];

export function StepLine({ className }: { className?: string }) {
  return (
    <ol className={cn("grid gap-4 md:grid-cols-3", className)}>
      {steps.map(({ Icon, step, title, body }, index) => (
        <li key={step} className="plate rail rail-brass flex flex-col gap-3 p-5 pl-6">
          <div className="flex items-center justify-between gap-3">
            <span className="label-micro">{step}</span>
            <AnimatedIcon icon={Icon} idiom="strike" className="size-6 text-[var(--brass-500)]" />
          </div>
          <h3 className="heading text-[20px] leading-tight">{title}</h3>
          <p className="text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">{body}</p>
          {index < steps.length - 1 ? (
            <span aria-hidden="true" className="rule-brass mt-1 hidden md:block" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
