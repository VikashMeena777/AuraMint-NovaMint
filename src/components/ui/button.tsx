"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Button — The Mint.
 *
 * Mint rules encoded here:
 * - `strike` is the primary action: patina plate, near-square corners.
 * - `brass` is reserved for prestige (premium, boosts, legendary) and is never
 *   used for ordinary body actions.
 * - Motion is the "Strike" idiom (a short press that settles), and it
 *   disappears entirely under `prefers-reduced-motion` — MotionConfig at the
 *   root enforces the same contract app-wide.
 */
const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] font-semibold transition-[background-color,border-color,box-shadow,color] duration-150 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        strike:
          "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border border-[hsl(var(--primary))] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.18)] hover:brightness-[1.07]",
        brass:
          "bg-[var(--brass-500)] text-[#1A1405] border border-[var(--brass-600)] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35)] hover:brightness-[1.05]",
        plate:
          "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] border border-[hsl(var(--border))] hover:border-[hsl(var(--muted-foreground)/0.55)] hover:bg-[hsl(var(--secondary))]",
        quiet:
          "bg-transparent text-[hsl(var(--muted-foreground))] border border-transparent hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]",
        danger:
          "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] border border-[hsl(var(--destructive))] hover:brightness-[1.06]",
        link: "text-[hsl(var(--primary))] underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-3 text-[14px] [&_svg]:size-4",
        md: "h-11 px-4 text-[14px] [&_svg]:size-4",
        lg: "h-12 px-6 text-[16px] [&_svg]:size-[18px]",
        icon: "size-11 [&_svg]:size-[18px]",
        "icon-sm": "size-9 [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "plate",
      size: "md",
    },
  }
);

const MotionButton = motion.create("button");

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render as the single child element (e.g. a Next.js `<Link>`). */
    asChild?: boolean;
    /** Opt out of the press animation for dense toolbars and drag handles. */
    still?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  still = false,
  children,
  ...props
}: ButtonProps) {
  const reduceMotion = useReducedMotion();
  const classes = cn(buttonVariants({ variant, size }), className);

  // asChild keeps Radix Slot's single-child contract — no wrapper element, so
  // `w-full` and grid/flex placement keep working for link-buttons.
  if (asChild) {
    return (
      <Slot className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  if (still || reduceMotion) {
    return (
      <button className={classes} {...props}>
        {children}
      </button>
    );
  }

  // Framer's event props are richer than the DOM's (e.g. `onDrag` receives
  // PanInfo), so the native prop bag is narrowed rather than widened: callers
  // keep the standard `<button>` API and we only forward it.
  const motionProps = props as unknown as HTMLMotionProps<"button">;

  return (
    <MotionButton
      className={classes}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 600, damping: 34 }}
      {...motionProps}
    >
      {children}
    </MotionButton>
  );
}

export { Button, buttonVariants };
