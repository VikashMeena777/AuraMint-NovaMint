import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Plate primitives — the only surface in The Mint.
 *
 * A plate is solid (never glass), ruled with a 1px hairline, with a small
 * inner top highlight so it reads as struck metal rather than a floating card.
 * `tone` selects the metal: lead (neutral), brass (prestige), patina (positive),
 * oxide (negative). `rail` adds the 3px polarity edge that keeps meaning
 * readable in greyscale.
 */
type PlateTone = "default" | "brass" | "positive" | "negative";
type PlateRail = "none" | "positive" | "negative" | "brass";

// Tone and rail colours are unlayered classes in globals.css: `.plate` sets a
// border shorthand, so utility overrides would lose the cascade fight.
const toneClass: Record<PlateTone, string> = {
  default: "",
  brass: "plate-brass",
  positive: "plate-positive",
  negative: "plate-negative",
};

const railClass: Record<Exclude<PlateRail, "none">, string> = {
  positive: "rail-positive",
  negative: "rail-negative",
  brass: "rail-brass",
};

function Plate({
  className,
  tone = "default",
  rail = "none",
  interactive = false,
  as: Comp = "div",
  ...props
}: React.ComponentProps<"div"> & {
  tone?: PlateTone;
  rail?: PlateRail;
  interactive?: boolean;
  as?: React.ElementType;
}) {
  return (
    <Comp
      className={cn(
        "plate",
        // `.rail` (globals.css) draws the 3px polarity edge; the tone class only
        // swaps its colour, so the rail geometry is defined in exactly one place.
        rail !== "none" && ["rail", railClass[rail]],
        toneClass[tone],
        interactive && "is-interactive",
        className
      )}
      {...props}
    />
  );
}

function PlateHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1 border-b border-[hsl(var(--border))] p-5", className)}
      {...props}
    />
  );
}

function PlateTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("heading text-[20px] leading-tight", className)} {...props} />;
}

function PlateDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p className={cn("text-[14px] text-[hsl(var(--muted-foreground))]", className)} {...props} />
  );
}

function PlateBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

function PlateFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-t border-[hsl(var(--border))] p-5",
        className
      )}
      {...props}
    />
  );
}

export { Plate, PlateHeader, PlateTitle, PlateDescription, PlateBody, PlateFooter };
