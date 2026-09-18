"use client";

import * as React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { markForIcon } from "@/components/icons/registry";

/**
 * AnimatedIcon — the app's icon entry point.
 *
 * Two layers:
 * 1. Icons with a registered **mark** (`src/components/icons/marks.tsx`) animate
 *    their own SVG parts: the stamp drives down, the sun's rays extend, the
 *    magnifier draws its lens. The host span stays still and only carries the
 *    state label, which Framer propagates to the parts.
 * 2. Everything else keeps the four sanctioned whole-glyph idioms below.
 *
 * Interaction contract:
 * - The state comes from the *control the icon belongs to* (nearest `<a>`,
 *   `<button>`, `[role=button]`, `<summary>`, `<label>`), found on mount. Hover,
 *   keyboard focus (`:focus-visible` only, so a mouse click does not read as
 *   focus) and press all drive the same state machine, so keyboard users get the
 *   same feedback as pointer users.
 * - The icon wrapper is a plain `aria-hidden` span: nothing interactive is
 *   nested inside the button or link that owns it.
 * - `hovered` still hands hover control to a parent row (the sidebar uses it) —
 *   press feedback keeps working in that mode.
 * - Reduced motion: no listeners, no transforms, no stroke draws. The icon is
 *   simply the glyph.
 */

type IconIdiom = "nudge" | "strike" | "slide" | "press";

const idioms: Record<IconIdiom, Variants> = {
  // lift: nav rows and list items
  nudge: { rest: { y: 0 }, hover: { y: -2 }, focus: { y: -2 }, active: { y: 0 } },
  // the mint press: primary actions and reveals
  strike: {
    rest: { scale: 1, rotate: 0 },
    hover: { scale: 1.1, rotate: -5 },
    focus: { scale: 1.1, rotate: -5 },
    active: { scale: 1.04 },
  },
  // direction: "next" / "open" affordances
  slide: { rest: { x: 0 }, hover: { x: 3 }, focus: { x: 3 }, active: { x: 3 } },
  // denser controls
  press: {
    rest: { scale: 1 },
    hover: { scale: 1.06 },
    focus: { scale: 1.06 },
    active: { scale: 1 },
  },
};

/** A mark animates its own parts; the host span holds still. */
const still: Variants = { rest: {}, hover: {}, focus: {}, active: {} };

type IconState = "rest" | "hover" | "focus" | "active";

/** `:focus-visible` is not in very old engines; a bad selector must not throw. */
function matchesFocusVisible(element: HTMLElement): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}

export type AnimatedIconProps = {
  icon: LucideIcon;
  /** Optical size classes for the wrapper, e.g. `size-5`. */
  className?: string;
  idiom?: IconIdiom;
  /** Highlight the icon as the active/current destination. */
  active?: boolean;
  /** Controlled hover, when the surrounding row is the hover target. */
  hovered?: boolean;
  strokeWidth?: number;
};

function AnimatedIcon({
  icon: Icon,
  className,
  idiom = "nudge",
  active = false,
  hovered,
  strokeWidth = 1.75,
}: AnimatedIconProps) {
  const prefersReduced = useReducedMotion();
  const reduceMotion = prefersReduced === true;
  // A registry lookup, not a component created here: the mark is a plain render
  // function, so it is called (and returns already-built elements) rather than
  // mounted as a new component type on every render.
  const mark = markForIcon(Icon);

  const hostRef = React.useRef<HTMLSpanElement>(null);
  const [pointer, setPointer] = React.useState(false);
  const [keyboard, setKeyboard] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);

  // `hovered` (a defined value, including `false`) means the parent row owns
  // hover; the icon then only tracks press.
  const controlled = hovered !== undefined;

  React.useEffect(() => {
    if (reduceMotion) return;
    const node = hostRef.current;
    if (!node) return;

    const host: HTMLElement =
      node.closest<HTMLElement>("a, button, [role='button'], summary, label, input") ?? node;

    const enter = () => setPointer(true);
    const leave = () => {
      setPointer(false);
      setPressed(false);
    };
    const down = () => {
      setPressed(true);
      setKeyboard(false);
    };
    const up = () => setPressed(false);
    const focusIn = () => {
      if (matchesFocusVisible(host)) setKeyboard(true);
    };
    const focusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (!next || !host.contains(next)) setKeyboard(false);
    };

    if (!controlled) {
      host.addEventListener("pointerenter", enter);
      host.addEventListener("pointerleave", leave);
      host.addEventListener("focusin", focusIn);
      host.addEventListener("focusout", focusOut);
    }
    host.addEventListener("pointerdown", down);
    host.addEventListener("pointerup", up);
    host.addEventListener("pointercancel", leave);

    return () => {
      host.removeEventListener("pointerenter", enter);
      host.removeEventListener("pointerleave", leave);
      host.removeEventListener("focusin", focusIn);
      host.removeEventListener("focusout", focusOut);
      host.removeEventListener("pointerdown", down);
      host.removeEventListener("pointerup", up);
      host.removeEventListener("pointercancel", leave);
    };
  }, [controlled, reduceMotion]);

  const engaged = controlled ? Boolean(hovered) : pointer || keyboard;

  let label: IconState = "rest";
  if (pressed) label = "active";
  else if (engaged) label = "hover";
  // A current destination sits in its engaged pose. Without a mark the old
  // behaviour is kept (`active` is the neutral pose for `nudge`).
  else if (active) label = mark ? "hover" : "active";

  const animate = reduceMotion ? "rest" : label;

  return (
    <motion.span
      ref={hostRef}
      aria-hidden="true"
      variants={mark ? still : idioms[idiom]}
      initial="rest"
      animate={animate}
      transition={{ type: "spring", stiffness: 520, damping: 30 }}
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
    >
      {mark ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-full"
          aria-hidden="true"
          focusable="false"
        >
          {mark({ reduced: reduceMotion, strokeWidth })}
        </svg>
      ) : (
        <Icon className="size-full" strokeWidth={strokeWidth} aria-hidden="true" />
      )}
    </motion.span>
  );
}

export { AnimatedIcon };
