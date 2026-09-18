"use client";

import * as React from "react";
import { animate, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * AuraNumber — the single owner of how an aura figure looks and moves.
 *
 * This is the permanent fix for the old "double sign + identical colour" bug:
 * the sign, the colour and the tabular figures are decided in one place, so a
 * positive number can never render as "++150" and a loss can never be green.
 *
 * The count-up ("Roll") snaps straight to the final value under reduced motion,
 * and the first render is always the true value, so SSR and hydration agree.
 */
function formatFigure(value: number): string {
  const rounded = Math.round(value);
  return new Intl.NumberFormat("en-IN").format(Math.abs(rounded));
}

export type AuraNumberProps = {
  value: number;
  /** Show an explicit plus for positive values; negative values always keep their minus. */
  signed?: boolean;
  /** Run the roll-up animation when the value changes. */
  animateOnChange?: boolean;
  size?: "sm" | "md" | "lg" | "display";
  className?: string;
};

const sizes: Record<NonNullable<AuraNumberProps["size"]>, string> = {
  sm: "text-[14px]",
  md: "text-[20px]",
  lg: "text-[28px]",
  display: "text-[40px] sm:text-[56px] leading-none",
};

function AuraNumber({
  value,
  signed = true,
  animateOnChange = true,
  size = "md",
  className,
}: AuraNumberProps) {
  const reduceMotion = useReducedMotion();
  const rolling = animateOnChange && !reduceMotion;
  const [rolled, setRolled] = React.useState(value);
  const from = React.useRef(value);

  React.useEffect(() => {
    if (!rolling) return;
    const controls = animate(from.current, value, {
      duration: 0.75,
      ease: [0.2, 0.9, 0.15, 1],
      onUpdate: (latest) => setRolled(latest),
      onComplete: () => setRolled(value),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, rolling]);

  const shown = rolling ? rolled : value;
  const polarity = value > 0 ? "positive" : value < 0 ? "negative" : "neutral";

  return (
    <span
      className={cn(
        "mono engraved inline-flex items-baseline font-medium tabular-nums",
        sizes[size],
        polarity === "positive" && "text-[var(--patina-400)]",
        polarity === "negative" && "text-[var(--oxide-500)]",
        polarity === "neutral" && "text-[hsl(var(--muted-foreground))]",
        className
      )}
      title={`${signed && value > 0 ? "+" : ""}${Math.round(value).toLocaleString("en-IN")} aura`}
    >
      {polarity === "negative" ? "−" : signed && polarity === "positive" ? "+" : ""}
      {formatFigure(shown)}
    </span>
  );
}

export { AuraNumber };
