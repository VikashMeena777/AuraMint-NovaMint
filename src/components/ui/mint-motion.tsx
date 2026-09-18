"use client";

import * as React from "react";
import Image from "next/image";
import { useAnimate, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { MintIcon } from "@/components/icons/mint-icon";
import { AuraNumber } from "@/components/ui/aura-number";
import {
  Receipt,
  ReceiptGuilloche,
  ReceiptRow,
  ReceiptRule,
  ReceiptSerial,
  ReceiptTotal,
} from "@/components/ui/receipt";
import styles from "@/components/ui/mint-motion.module.css";

/**
 * The landing's motion furniture.
 *
 * Two rules decide everything here:
 * 1. **Server HTML is never hidden.** The entrance (`Reveal`) only arms an
 *    element *after* the first paint, and only when it starts below the fold;
 *    the hero settles with transform-only keyframes. With JS off, with a slow
 *    connection, or with reduced motion, every word of copy is simply there.
 * 2. **Every animation is finite and provoked.** Sections settle once on entry;
 *    the coin strikes when it is pressed or when it is entered with the
 *    keyboard. Nothing loops, nothing twinkles, nothing follows the cursor.
 */

/* ═══════════════════════════════════════════════════════════════════════
   Reveal — a staggered entrance that is visible by default
   ═══════════════════════════════════════════════════════════════════════ */

export type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Stagger offset in ms, applied as a transition delay. */
  delay?: number;
};

export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    // Anything the visitor can already see stays visible — no flash, no dip.
    if (node.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    node.classList.add(styles.armed);
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        node.classList.remove(styles.armed);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(styles.reveal, className)}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   HeroSpecimen — the coin, the press, and the specimen receipt
   ═══════════════════════════════════════════════════════════════════════ */

export type SpecimenRow = {
  label: string;
  value: string;
  tone: "positive" | "negative";
};

export type HeroSpecimenProps = {
  /** Ledger lines shown on the specimen receipt (plain data: this is a client island). */
  rows: readonly SpecimenRow[];
  /** The running total printed on the specimen. */
  total: number;
  /** Deterministic serials; each press advances to the next one. */
  serials: readonly string[];
  className?: string;
};

/**
 * The press: a real `<button>` holding the coin (never a div inside a button,
 * and never a button inside a button). Pressing it — or Enter/Space on it —
 * drives the coin down, fires the impact ring, jolts the paper and re-strikes
 * the serial. The whole sequence is finite and settles in ~700ms; under reduced
 * motion the coin stays still and only the serial and the overprint change.
 */
export function HeroSpecimen({ rows, total, serials, className }: HeroSpecimenProps) {
  const reduceMotion = useReducedMotion();
  const [scope, animate] = useAnimate();
  const [presses, setPresses] = React.useState(0);

  const serial = serials[presses % serials.length] ?? "#————";

  const press = React.useCallback(() => {
    setPresses((count) => count + 1);
    if (reduceMotion) return;

    // Sequence: the die drives down, then springs back while the ring expands.
    void animate(
      [
        ["[data-coin]", { y: 7, scaleY: 0.94, scaleX: 1.025 }, { duration: 0.09, ease: "easeOut" }],
        ["[data-ring]", { scale: [0.62, 1.5], opacity: [0.6, 0] }, { duration: 0.62, ease: [0.2, 0.9, 0.15, 1] }],
        ["[data-coin]", { y: 0, scaleY: 1, scaleX: 1 }, { type: "spring", stiffness: 640, damping: 25 }],
      ],
      { delay: 0.06 }
    );
  }, [animate, reduceMotion]);

  return (
    <div ref={scope} className={cn("relative", className)}>
      <div aria-hidden="true" className="guilloche-corner pointer-events-none absolute inset-0" />

      <div className="relative flex flex-col gap-6">
        {/* ── The press ─────────────────────────────────────────────── */}
        <div className={cn(styles.rigSettle, "flex flex-wrap items-center gap-5")}>
          <button
            type="button"
            onClick={press}
            aria-label="Strike the specimen coin"
            aria-describedby="hero-press-note"
            className="group relative inline-flex flex-none items-center justify-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[hsl(var(--ring))]"
          >
            <span className={cn(styles.impact)} data-ring aria-hidden="true" />
            <span className={cn(styles.plinth, "transition-transform group-active:scale-[0.97] motion-reduce:transition-none")}>
              <Image
                data-coin
                src="/auramint-coin.svg"
                alt=""
                width={84}
                height={84}
                className="size-[84px]"
                priority
              />
            </span>
          </button>

          <div className="max-w-[16rem]">
            <p className="label-micro">The mint press</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              Press the coin. The specimen re-strikes its serial, the way a real entry does.
            </p>
            <p id="hero-press-note" className="mono mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">
              {presses === 0 ? "awaiting first strike" : `struck ${presses}×`}
            </p>
          </div>
        </div>

        {/* ── The specimen receipt ──────────────────────────────────── */}
        <div className={cn(styles.paperSettle, "relative w-full lg:mt-1")}>
          <span
            aria-hidden="true"
            className={cn(
              "label-micro absolute right-3 top-3 z-10 -rotate-[3deg] rounded-[var(--radius-sm)] border border-[var(--brass-600)] px-2 py-0.5 text-[var(--brass-600)]",
              presses > 0 ? "animate-plate-in" : "opacity-0"
            )}
          >
            Struck
          </span>

          <Receipt
            key={presses}
            className={cn("mx-auto max-w-md", presses > 0 && "animate-strike")}
          >
            <ReceiptGuilloche className="-mx-5 -mt-5 mb-4 sm:-mx-6" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label-micro">Specimen · today&rsquo;s ledger</p>
                <p className="heading mt-1 text-[20px] leading-tight">Sample entries</p>
              </div>
              <MintIcon name="landmark" idiom="strike" className="size-6 text-[var(--brass-500)]" />
            </div>

            <ReceiptRule className="animate-settle" />

            <div className="flex flex-col gap-3">
              {rows.map((row) => (
                <div key={row.label} className="flex items-baseline">
                  <span className="text-[13px] text-[hsl(var(--muted-foreground))]">{row.label}</span>
                  <span aria-hidden="true" className="leader" />
                  <span
                    className={
                      row.tone === "positive"
                        ? "mono text-[14px] text-[var(--patina-400)]"
                        : "mono text-[14px] text-[var(--oxide-500)]"
                    }
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <ReceiptRule className="animate-settle" />

            <ReceiptRow label="Entries today" value="3 of 5" hint="Free plan limit" />
            <ReceiptRow label="Current tier" value="NPC" hint="0 – 4,999 total aura" />

            <div className="mt-4">
              <ReceiptTotal label="Running total">
                <AuraNumber value={total} size="display" animateOnChange={false} />
              </ReceiptTotal>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <ReceiptSerial
                serial={serial}
                timestamp={presses > 0 ? "re-struck" : "specimen"}
              />
            </div>
          </Receipt>

          <p aria-live="polite" className="sr-only">
            {presses === 0 ? "" : `Specimen re-struck. Serial ${serial}.`}
          </p>
        </div>
      </div>

      <p className="mt-4 text-[12px] text-[hsl(var(--muted-foreground))]">
        A specimen receipt, not a live account. Your first entry prints your own.
      </p>
    </div>
  );
}
