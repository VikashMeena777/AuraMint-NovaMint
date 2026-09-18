"use client";

import * as React from "react";
import { motion, type TargetAndTransition, type Transition, type Variants } from "framer-motion";

/**
 * Mint icon marks — the animated half of `AnimatedIcon`.
 *
 * Each mark is a first-party set of SVG parts (drawn on the same 24×24 grid as
 * the Lucide glyph it replaces, so it drops into the existing layout at the same
 * optical weight). Parts are `motion.*` elements that declare their own
 * `rest / hover / focus / active` variants: the host `AnimatedIcon` only supplies
 * the state label, and Framer's variant propagation drives every part from it.
 * That keeps the animated icons prop-free — no timers, no imperative handles.
 *
 * Motion contract (enforced by review, and by `reduced`):
 * - Every animation is finite and triggered by hover, keyboard focus or press.
 *   Nothing loops, nothing spins, nothing drifts.
 * - `reduced` (from `useReducedMotion`) turns off stroke draws; Framer's
 *   `reducedMotion="user"` and the global reduced-motion CSS already drop the
 *   transforms. With motion off, the marks render as the plain glyph.
 */

export type IconMarkProps = {
  /** Stroke width inherited from the host icon (the app draws at 1.75). */
  strokeWidth?: number;
  /** The visitor asked for reduced motion: no transforms, no stroke draws. */
  reduced?: boolean;
};

export type IconMark = (props: IconMarkProps) => React.ReactElement;

type Frame = {
  rest: TargetAndTransition;
  hover: TargetAndTransition;
  /** Defaults to `hover`, so a keyboard user gets the same answer as a pointer. */
  focus?: TargetAndTransition;
  /** Defaults to `hover`. */
  active?: TargetAndTransition;
};

/** The one press spring shared by every mark: quick, overdamped, no wobble. */
const PRESS: Transition = { type: "spring", stiffness: 620, damping: 34 };

/**
 * One part, four states. A part must define all four labels: a missing label
 * leaves that part stuck in its previous pose when the state changes.
 */
function part(frame: Frame): Variants {
  return {
    rest: frame.rest,
    hover: frame.hover,
    focus: frame.focus ?? frame.hover,
    active: frame.active ?? frame.hover,
  };
}

const P = motion.path;
const C = motion.circle;
const R = motion.rect;

/** A pivot inside the 24×24 view box: rotate/scale around the drawing, not the box. */
const viewPivot = (x: number, y: number): React.CSSProperties => ({
  transformBox: "view-box",
  transformOrigin: `${x}px ${y}px`,
});

/** A pivot on the part's own bounding box (percentages of the drawn part). */
const boxPivot = (x = "50%", y = "50%"): React.CSSProperties => ({
  transformBox: "fill-box",
  transformOrigin: `${x} ${y}`,
});

/* ═══════════════════════════════════════════════════════════════════════
   Marks
   ═══════════════════════════════════════════════════════════════════════ */

const stamp: IconMark = () => (
  <>
    <P
      d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13"
      variants={part({
        rest: { y: 0 },
        hover: { y: -0.9 },
        active: { y: 1.6, transition: PRESS },
      })}
    />
    <P
      d="M20 15.5a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1z"
      variants={part({
        rest: { y: 0 },
        hover: { y: -0.3 },
        active: { y: 0.9, transition: PRESS },
      })}
    />
    <P
      d="M5 22h14"
      style={boxPivot()}
      variants={part({ rest: { opacity: 0.5 }, hover: { opacity: 1 }, active: { opacity: 1 } })}
    />
  </>
);

const sparkles: IconMark = () => (
  <>
    <P
      d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"
      style={boxPivot("50%", "50%")}
      variants={part({
        rest: { scale: 1, rotate: 0 },
        hover: { scale: 1.09, rotate: 12 },
        active: { scale: 0.94, rotate: 0, transition: PRESS },
      })}
    />
    <P
      d="M20 2v4"
      style={boxPivot()}
      variants={part({ rest: { scale: 1, opacity: 0.9 }, hover: { scale: 1.4 }, active: { scale: 1.4 } })}
    />
    <P
      d="M22 4h-4"
      style={boxPivot()}
      variants={part({ rest: { scale: 1, opacity: 0.9 }, hover: { scale: 1.4 }, active: { scale: 1.4 } })}
    />
    <C
      cx={4}
      cy={20}
      r={2}
      style={boxPivot()}
      variants={part({
        rest: { scale: 1, opacity: 0.75 },
        hover: { scale: 1.3, opacity: 1, transition: { delay: 0.04 } },
        active: { scale: 1.3, opacity: 1 },
      })}
    />
  </>
);

const zap: IconMark = () => (
  <P
    d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"
    style={boxPivot()}
    variants={part({
      rest: { scale: 1, opacity: 0.92 },
      hover: { scale: 1.08, opacity: 1, rotate: -4 },
      active: { scale: 0.96, rotate: 0, transition: PRESS },
    })}
  />
);

const search: IconMark = ({ reduced }: IconMarkProps) => (
  <>
    <C
      cx={11}
      cy={11}
      r={8}
      variants={part({
        rest: { pathLength: 1, pathOffset: 0 },
        hover: { pathLength: reduced ? 1 : 0.42, pathOffset: reduced ? 0 : 0.58 },
        active: { pathLength: 1, pathOffset: 0 },
      })}
    />
    <P
      d="m21 21-4.34-4.34"
      variants={part({
        rest: { x: 0, y: 0 },
        hover: { x: 1, y: 1 },
        active: { x: 1.4, y: 1.4, transition: PRESS },
      })}
    />
  </>
);

const menu: IconMark = () => (
  <>
    <P
      d="M4 5h16"
      style={boxPivot()}
      variants={part({ rest: { y: 0, scaleX: 1 }, hover: { y: 1.1, scaleX: 0.94 }, active: { y: 0, scaleX: 1 } })}
    />
    <P
      d="M4 12h16"
      style={boxPivot()}
      variants={part({
        rest: { scaleX: 1 },
        hover: { scaleX: 0.62, transition: { duration: 0.22, ease: [0.2, 0.9, 0.15, 1] } },
        active: { scaleX: 1, transition: PRESS },
      })}
    />
    <P
      d="M4 19h16"
      style={boxPivot()}
      variants={part({ rest: { y: 0, scaleX: 1 }, hover: { y: -1.1, scaleX: 0.94 }, active: { y: 0, scaleX: 1 } })}
    />
  </>
);

/** Sun rays, each with the direction it travels when the icon is engaged. */
const SUN_RAYS: { d: string; dx: number; dy: number }[] = [
  { d: "M12 2v2", dx: 0, dy: -0.85 },
  { d: "M12 20v2", dx: 0, dy: 0.85 },
  { d: "M2 12h2", dx: -0.85, dy: 0 },
  { d: "M20 12h2", dx: 0.85, dy: 0 },
  { d: "m4.93 4.93 1.41 1.41", dx: -0.6, dy: -0.6 },
  { d: "m17.66 17.66 1.41 1.41", dx: 0.6, dy: 0.6 },
  { d: "m6.34 17.66-1.41 1.41", dx: -0.6, dy: 0.6 },
  { d: "m19.07 4.93-1.41 1.41", dx: 0.6, dy: -0.6 },
];

const sun: IconMark = () => (
  <>
    <C
      cx={12}
      cy={12}
      r={4}
      style={boxPivot()}
      variants={part({
        rest: { scale: 1 },
        hover: { scale: 1.12 },
        active: { scale: 0.9, transition: PRESS },
      })}
    />
    {SUN_RAYS.map((ray) => (
      <P
        key={ray.d}
        d={ray.d}
        variants={part({
          rest: { x: 0, y: 0 },
          hover: { x: ray.dx, y: ray.dy },
          active: { x: ray.dx * 0.4, y: ray.dy * 0.4, transition: PRESS },
        })}
      />
    ))}
  </>
);

const moon: IconMark = () => (
  <P
    d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"
    style={boxPivot()}
    variants={part({
        rest: { rotate: 0, scale: 1 },
        hover: { rotate: -8, scale: 1.05 },
        active: { rotate: 0, scale: 0.96, transition: PRESS },
    })}
  />
);

const crown: IconMark = () => (
  <>
    <P
      d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"
      variants={part({
        rest: { y: 0, scale: 1 },
        hover: { y: -1.1, scale: 1.03 },
        active: { y: 0.9, scale: 0.96, transition: PRESS },
      })}
    />
    <P
      d="M5 21h14"
      style={boxPivot()}
      variants={part({
        rest: { scaleX: 1, opacity: 0.85 },
        hover: { scaleX: 0.9, opacity: 1 },
        active: { scaleX: 1.03, opacity: 1 },
      })}
    />
  </>
);

const flame: IconMark = () => (
  <P
    d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"
    style={boxPivot("50%", "80%")}
    variants={part({
      rest: { y: 0, scaleY: 1, rotate: 0 },
      // One finite flicker — a flame that breathes, not a loop.
      hover: {
        scaleY: [1, 1.07, 1.02],
        rotate: [0, -3, 2, 0],
        y: -0.6,
        transition: { duration: 0.55, ease: "easeInOut" },
      },
      focus: { y: -0.6, scaleY: 1.05 },
      active: { scaleY: 0.9, y: 0.4, rotate: 0, transition: PRESS },
    })}
  />
);

const trophy: IconMark = () => (
  <>
    <P
      d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"
      style={boxPivot("50%", "100%")}
      variants={part({
        rest: { scale: 1, y: 0 },
        hover: { scaleY: 1.05, y: 0 },
        active: { scaleY: 0.95, y: 0.5, transition: PRESS },
      })}
    />
    <P
      d="M6 9H4.5a1 1 0 0 1 0-5H6"
      style={boxPivot("100%", "50%")}
      variants={part({ rest: { rotate: 0 }, hover: { rotate: -12 }, active: { rotate: -4 } })}
    />
    <P
      d="M18 9h1.5a1 1 0 0 0 0-5H18"
      style={boxPivot("0%", "50%")}
      variants={part({ rest: { rotate: 0 }, hover: { rotate: 12 }, active: { rotate: 4 } })}
    />
    <P d="M4 22h16" variants={part({ rest: { opacity: 0.8 }, hover: { opacity: 1 }, active: { opacity: 1 } })} />
    <P
      d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978"
      variants={part({ rest: { x: 0 }, hover: { x: -0.6 }, active: { x: 0 } })}
    />
    <P
      d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978"
      variants={part({ rest: { x: 0 }, hover: { x: 0.6 }, active: { x: 0 } })}
    />
  </>
);

const gauge: IconMark = () => (
  <>
    <P
      d="m12 14 4-4"
      style={viewPivot(12, 14)}
      variants={part({
        rest: { rotate: 0 },
        hover: { rotate: -42, transition: { type: "spring", stiffness: 320, damping: 20 } },
        active: { rotate: 6, transition: PRESS },
      })}
    />
    <P
      d="M3.34 19a10 10 0 1 1 17.32 0"
      variants={part({ rest: { opacity: 0.75 }, hover: { opacity: 1 }, active: { opacity: 1 } })}
    />
  </>
);

const penLine: IconMark = ({ reduced }: IconMarkProps) => (
  <>
    <P
      d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
      variants={part({
        rest: { x: 0, y: 0 },
        hover: { x: -0.9, y: 0.9 },
        active: { x: 0.5, y: -0.5, transition: PRESS },
      })}
    />
    <P
      d="M13 21h8"
      style={viewPivot(13, 21)}
      variants={part({
        rest: { pathLength: 1, opacity: 0.65 },
        // The line is written as the pen settles — the one "drawing" mark.
        hover: { pathLength: reduced ? 1 : 0.999, opacity: 1 },
        focus: { pathLength: reduced ? 1 : 0.999, opacity: 1 },
        active: { pathLength: 1, opacity: 1 },
      })}
    />
  </>
);

const bookOpenText: IconMark = () => (
  <>
    <P
      d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"
      style={boxPivot("50%", "100%")}
      variants={part({
        rest: { scaleY: 1 },
        hover: { scaleY: 1.04 },
        active: { scaleY: 0.97, transition: PRESS },
      })}
    />
    <P d="M12 7v14" variants={part({ rest: { opacity: 0.6 }, hover: { opacity: 1 }, active: { opacity: 1 } })} />
    <P
      d="M16 8h2"
      variants={part({ rest: { x: 0, opacity: 0.7 }, hover: { x: 0.8, opacity: 1, transition: { delay: 0.03 } }, active: { x: 0.8, opacity: 1 } })}
    />
    <P
      d="M16 12h2"
      variants={part({ rest: { x: 0, opacity: 0.7 }, hover: { x: 0.8, opacity: 1, transition: { delay: 0.07 } }, active: { x: 0.8, opacity: 1 } })}
    />
    <P
      d="M6 8h2"
      variants={part({ rest: { x: 0, opacity: 0.7 }, hover: { x: -0.8, opacity: 1, transition: { delay: 0.05 } }, active: { x: -0.8, opacity: 1 } })}
    />
    <P
      d="M6 12h2"
      variants={part({ rest: { x: 0, opacity: 0.7 }, hover: { x: -0.8, opacity: 1, transition: { delay: 0.09 } }, active: { x: -0.8, opacity: 1 } })}
    />
  </>
);

const rotateCcw: IconMark = () => (
  <P
    d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
    style={viewPivot(12, 12)}
    variants={part({
      rest: { rotate: 0 },
      hover: { rotate: -32 },
      // A full turn back to zero: the "mint again" gesture.
      active: { rotate: -360, transition: { duration: 0.5, ease: [0.2, 0.9, 0.15, 1] } },
    })}
  />
);

const moveRight: IconMark = () => (
  <>
    <P
      d="M2 12H22"
      style={viewPivot(2, 12)}
      variants={part({
        rest: { scaleX: 0.86 },
        hover: { scaleX: 1 },
        active: { scaleX: 1, transition: PRESS },
      })}
    />
    <P
      d="M18 8L22 12L18 16"
      variants={part({ rest: { x: 0 }, hover: { x: 0.7 }, active: { x: 1.2, transition: PRESS } })}
    />
  </>
);

const arrowRight: IconMark = () => (
  <>
    <P
      d="M5 12h14"
      style={viewPivot(5, 12)}
      variants={part({
        rest: { scaleX: 0.86 },
        hover: { scaleX: 1 },
        active: { scaleX: 1, transition: PRESS },
      })}
    />
    <P
      d="m12 5 7 7-7 7"
      variants={part({ rest: { x: 0 }, hover: { x: 0.8 }, active: { x: 1.2, transition: PRESS } })}
    />
  </>
);

const eye: IconMark = () => (
  <>
    <P
      d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
      style={boxPivot()}
      variants={part({
        rest: { scaleY: 1 },
        hover: { scaleY: 0.84 },
        // A full blink on press: the ledger looks away for one frame.
        active: { scaleY: 0.14, transition: { duration: 0.14, ease: "easeOut" } },
      })}
    />
    <C
      cx={12}
      cy={12}
      r={3}
      style={boxPivot()}
      variants={part({ rest: { scale: 1, opacity: 1 }, hover: { scale: 1.14 }, active: { scale: 0.7, opacity: 0.4 } })}
    />
  </>
);

const landmark: IconMark = () => (
  <>
    <P
      d="M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z"
      variants={part({ rest: { y: 0 }, hover: { y: -1.2 }, active: { y: 0.6, transition: PRESS } })}
    />
    {["M6 18v-7", "M10 18v-7", "M14 18v-7", "M18 18v-7"].map((d, index) => (
      <P
        key={d}
        d={d}
        style={boxPivot("50%", "100%")}
        variants={part({
          rest: { scaleY: 1 },
          hover: { scaleY: 0.9, transition: { delay: index * 0.02 } },
          active: { scaleY: 0.94 },
        })}
      />
    ))}
    <P d="M3 22h18" variants={part({ rest: { opacity: 0.8 }, hover: { opacity: 1 }, active: { opacity: 1 } })} />
  </>
);

const layers: IconMark = () => (
  <>
    <P
      d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"
      variants={part({ rest: { y: 0 }, hover: { y: -1 }, active: { y: 0.7, transition: PRESS } })}
    />
    <P
      d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"
      variants={part({ rest: { y: 0, opacity: 0.85 }, hover: { y: -0.7, opacity: 1 }, active: { y: 0.4 } })}
    />
    <P
      d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"
      variants={part({ rest: { y: 0, opacity: 0.85 }, hover: { y: 0, opacity: 1 }, active: { y: 0.2 } })}
    />
  </>
);

/** Badge and shield share the same "outline holds, the check strikes" idiom. */
function checkMarked(outline: string, outlineStyle?: React.CSSProperties): IconMark {
  function CheckMarked({ reduced }: IconMarkProps) {
    return (
      <>
        <P
          d={outline}
          style={outlineStyle}
          variants={part({
            rest: { scale: 1 },
            hover: { scale: 1.05 },
            active: { scale: 0.97, transition: PRESS },
          })}
        />
        <P
          d="m9 12 2 2 4-4"
          variants={part({
            rest: { pathLength: 1, x: 0 },
            hover: { pathLength: reduced ? 1 : 0.34, x: reduced ? 0 : 0.4 },
            focus: { pathLength: reduced ? 1 : 0.34, x: reduced ? 0 : 0.4 },
            active: { pathLength: 1, x: 0 },
          })}
        />
      </>
    );
  }
  CheckMarked.displayName = "CheckMarked";
  return CheckMarked;
}

const badgeCheck = checkMarked(
  "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
  boxPivot()
);

const shieldCheck = checkMarked(
  "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
  boxPivot("50%", "40%")
);

const rocket: IconMark = () => (
  <>
    <P
      d="M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"
      variants={part({
        rest: { x: 0, y: 0, rotate: 0 },
        hover: { x: 0.7, y: -0.9, rotate: 4 },
        active: { x: 0, y: 0.6, rotate: 0, transition: PRESS },
      })}
    />
    <P
      d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"
      style={boxPivot("80%", "20%")}
      variants={part({
        rest: { scale: 1, opacity: 0.7 },
        hover: { scale: 1.12, opacity: 1 },
        active: { scale: 0.94, opacity: 1 },
      })}
    />
    <P
      d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"
      variants={part({ rest: { opacity: 0.7 }, hover: { opacity: 1 }, active: { opacity: 1 } })}
    />
    <P
      d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05"
      variants={part({ rest: { opacity: 0.7 }, hover: { opacity: 1 }, active: { opacity: 1 } })}
    />
  </>
);

const palette: IconMark = () => (
  <>
    <P
      d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"
      style={boxPivot()}
      variants={part({
        rest: { rotate: 0, scale: 1 },
        hover: { rotate: 6, scale: 1.03 },
        active: { rotate: 0, scale: 0.97, transition: PRESS },
      })}
    />
    {[
      { cx: 13.5, cy: 6.5, delay: 0 },
      { cx: 17.5, cy: 10.5, delay: 0.04 },
      { cx: 6.5, cy: 12.5, delay: 0.08 },
      { cx: 8.5, cy: 7.5, delay: 0.12 },
    ].map((dot) => (
      <C
        key={`${dot.cx}-${dot.cy}`}
        cx={dot.cx}
        cy={dot.cy}
        r={0.5}
        fill="currentColor"
        style={boxPivot()}
        variants={part({
          rest: { scale: 1, opacity: 1 },
          hover: { scale: 1.8, opacity: 1, transition: { delay: dot.delay, type: "spring", stiffness: 480, damping: 22 } },
          active: { scale: 1.4, opacity: 1 },
        })}
      />
    ))}
  </>
);

const ban: IconMark = () => (
  <>
    <C
      cx={12}
      cy={12}
      r={10}
      style={boxPivot()}
      variants={part({ rest: { scale: 1 }, hover: { scale: 0.96 }, active: { scale: 0.98 } })}
    />
    <P
      d="M4.929 4.929 19.07 19.071"
      style={viewPivot(12, 12)}
      variants={part({
        rest: { rotate: 0, opacity: 0.9 },
        hover: { rotate: 9, opacity: 1 },
        active: { rotate: 0, opacity: 1, transition: PRESS },
      })}
    />
  </>
);

const barChart: IconMark = () => (
  <>
    <P d="M3 3v16a2 2 0 0 0 2 2h16" variants={part({ rest: { opacity: 0.85 }, hover: { opacity: 1 }, active: { opacity: 1 } })} />
    {[
      { d: "M8 17v-3", delay: 0 },
      { d: "M13 17V5", delay: 0.04 },
      { d: "M18 17V9", delay: 0.08 },
    ].map((bar) => (
      <P
        key={bar.d}
        d={bar.d}
        style={boxPivot("50%", "100%")}
        variants={part({
          rest: { scaleY: 1 },
          hover: {
            scaleY: 1.16,
            transition: { delay: bar.delay, type: "spring", stiffness: 420, damping: 20 },
          },
          active: { scaleY: 0.92 },
        })}
      />
    ))}
  </>
);

const skull: IconMark = () => (
  <>
    <P
      d="M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z"
      style={boxPivot()}
      variants={part({ rest: { scale: 1 }, hover: { scale: 1.04 }, active: { scale: 0.97, transition: PRESS } })}
    />
    <C
      cx={9}
      cy={12}
      r={1}
      fill="currentColor"
      style={boxPivot()}
      variants={part({ rest: { scale: 1 }, hover: { scale: 1.3 }, active: { scale: 0.5 } })}
    />
    <C
      cx={15}
      cy={12}
      r={1}
      fill="currentColor"
      style={boxPivot()}
      variants={part({ rest: { scale: 1 }, hover: { scale: 1.3 }, active: { scale: 0.5 } })}
    />
    <P
      d="m12.5 17-.5-1-.5 1h1z"
      variants={part({ rest: { opacity: 1 }, hover: { opacity: 1 }, active: { opacity: 0.6 } })}
    />
  </>
);

const ghost: IconMark = () => (
  <>
    <P
      d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"
      variants={part({ rest: { y: 0 }, hover: { y: -0.9 }, active: { y: 0.5, transition: PRESS } })}
    />
    <P
      d="M9 10h.01"
      variants={part({ rest: { opacity: 1 }, hover: { opacity: 1 }, active: { opacity: 0.35 } })}
    />
    <P
      d="M15 10h.01"
      variants={part({ rest: { opacity: 1 }, hover: { opacity: 1 }, active: { opacity: 0.35 } })}
    />
  </>
);

const user: IconMark = () => (
  <>
    <C
      cx={12}
      cy={7}
      r={4}
      style={boxPivot()}
      variants={part({ rest: { y: 0, scale: 1 }, hover: { y: -0.7, scale: 1.06 }, active: { scale: 0.94, transition: PRESS } })}
    />
    <P
      d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"
      variants={part({ rest: { y: 0 }, hover: { y: 0.6 }, active: { y: 0.3 } })}
    />
  </>
);

const star: IconMark = () => (
  <P
    d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"
    style={viewPivot(12, 12)}
    variants={part({
      rest: { rotate: 0, scale: 1 },
      hover: { rotate: 18, scale: 1.12 },
      active: { rotate: 0, scale: 0.94, transition: PRESS },
    })}
  />
);

const layoutDashboard: IconMark = () => (
  <>
    {[
      { key: "tl", x: 3, y: 3, width: 7, height: 9, delay: 0 },
      { key: "tr", x: 14, y: 3, width: 7, height: 5, delay: 0.04 },
      { key: "br", x: 14, y: 12, width: 7, height: 9, delay: 0.08 },
      { key: "bl", x: 3, y: 16, width: 7, height: 5, delay: 0.12 },
    ].map((panel) => (
      <R
        key={panel.key}
        x={panel.x}
        y={panel.y}
        width={panel.width}
        height={panel.height}
        rx={1}
        style={boxPivot()}
        variants={part({
          rest: { scale: 1 },
          hover: { scale: 1.05, transition: { delay: panel.delay, type: "spring", stiffness: 460, damping: 24 } },
          active: { scale: 0.95, transition: PRESS },
        })}
      />
    ))}
  </>
);

const medal: IconMark = () => (
  <>
    <C
      cx={12}
      cy={17}
      r={5}
      style={boxPivot()}
      variants={part({
        rest: { scale: 1, rotate: 0 },
        hover: { scale: 1.08, rotate: 10, transition: { type: "spring", stiffness: 380, damping: 18 } },
        active: { scale: 0.95, rotate: 0, transition: PRESS },
      })}
    />
    <P
      d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"
      variants={part({ rest: { y: 0, opacity: 0.85 }, hover: { y: -0.9, opacity: 1 }, active: { y: 0.4 } })}
    />
    <P d="M8 7h8" variants={part({ rest: { opacity: 0.85 }, hover: { opacity: 1 }, active: { opacity: 1 } })} />
    <P
      d="M12 18v-2h-.5"
      variants={part({ rest: { opacity: 1 }, hover: { opacity: 1 }, active: { opacity: 0.6 } })}
    />
  </>
);

const gift: IconMark = () => (
  <>
    <R
      x={3}
      y={7}
      width={18}
      height={4}
      rx={1}
      variants={part({ rest: { y: 0 }, hover: { y: -1.5 }, active: { y: -0.5, transition: PRESS } })}
    />
    <P
      d="M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5"
      variants={part({
        rest: { y: 0, scale: 1 },
        hover: { y: -1.1, scale: 1.05 },
        active: { y: -0.6, scale: 1, transition: PRESS },
      })}
    />
    <P
      d="M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"
      variants={part({ rest: { y: 0 }, hover: { y: 0.4 }, active: { y: 0.2 } })}
    />
    <P d="M12 7v14" variants={part({ rest: { opacity: 0.75 }, hover: { opacity: 1 }, active: { opacity: 1 } })} />
  </>
);

const gem: IconMark = () => (
  <>
    <P
      d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z"
      style={boxPivot()}
      variants={part({
        rest: { scale: 1, rotate: 0 },
        hover: { scale: 1.05, rotate: -4 },
        active: { scale: 0.96, rotate: 0, transition: PRESS },
      })}
    />
    <P d="M2 9h20" variants={part({ rest: { opacity: 0.8 }, hover: { opacity: 1 }, active: { opacity: 1 } })} />
    <P
      d="M10.5 3 8 9l4 13 4-13-2.5-6"
      variants={part({ rest: { opacity: 0.8 }, hover: { opacity: 1, x: 0 }, active: { opacity: 1 } })}
    />
  </>
);

const logOut: IconMark = () => (
  <>
    <P
      d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
      variants={part({ rest: { x: 0, opacity: 0.85 }, hover: { x: -0.6, opacity: 1 }, active: { x: -0.3 } })}
    />
    <P
      d="m16 17 5-5-5-5"
      variants={part({ rest: { x: 0 }, hover: { x: 1 }, active: { x: 1.5, transition: PRESS } })}
    />
    <P
      d="M21 12H9"
      style={viewPivot(9, 12)}
      variants={part({ rest: { scaleX: 1 }, hover: { scaleX: 0.86 }, active: { scaleX: 1, transition: PRESS } })}
    />
  </>
);

/** Name → mark. The registry maps these onto the Lucide glyphs they replace. */
export const MARKS = {
  stamp,
  sparkles,
  zap,
  search,
  menu,
  sun,
  moon,
  crown,
  flame,
  trophy,
  gauge,
  "pen-line": penLine,
  "book-open-text": bookOpenText,
  "rotate-ccw": rotateCcw,
  "move-right": moveRight,
  "arrow-right": arrowRight,
  eye,
  landmark,
  layers,
  "badge-check": badgeCheck,
  "shield-check": shieldCheck,
  rocket,
  palette,
  ban,
  "bar-chart": barChart,
  skull,
  ghost,
  user,
  star,
  "layout-dashboard": layoutDashboard,
  medal,
  gift,
  gem,
  "log-out": logOut,
} satisfies Record<string, IconMark>;

export type MarkName = keyof typeof MARKS;
