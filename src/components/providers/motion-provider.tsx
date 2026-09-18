"use client";

import { MotionConfig } from "framer-motion";

/**
 * MotionConfig wrapper.
 *
 * `reducedMotion="user"` makes every Framer Motion animation in the app obey
 * `prefers-reduced-motion` automatically — components no longer have to
 * remember, and a page added tomorrow inherits the behaviour. The CSS half of
 * the contract lives in the `@media (prefers-reduced-motion: reduce)` block in
 * `src/app/globals.css`.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.24, ease: [0.2, 0.9, 0.15, 1] }}>
      {children}
    </MotionConfig>
  );
}
