import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Assay receipt primitives — the product's own artefact.
 *
 * AuraMint's metaphor is a mint/assay office, so the surfaces that carry a
 * verdict are receipts: torn edges, dot-leader ledger rows, a serial line and a
 * stamped total. Everything here is layout only (server-renderable); the
 * interactive demo composes them with real values.
 */

/** A torn paper edge. Sits above or below a receipt body. */
function Perforation({
  position = "bottom",
  className,
}: {
  position?: "top" | "bottom";
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "h-2.5 bg-[hsl(var(--card))]",
        position === "bottom" ? "perforated-bottom" : "perforated-top",
        className
      )}
    />
  );
}

function Receipt({
  className,
  children,
  torn = "both",
  ...props
}: React.ComponentProps<"div"> & { torn?: "both" | "top" | "bottom" | "none" }) {
  return (
    <div className={cn("w-full", className)} {...props}>
      {torn === "both" || torn === "top" ? <Perforation position="top" /> : null}
      <div className="plate plate-receipt px-5 py-5 sm:px-6">{children}</div>
      {torn === "both" || torn === "bottom" ? <Perforation position="bottom" /> : null}
    </div>
  );
}

/** Header block: who/what/when, in the receipt's own voice. */
function ReceiptHeader({
  title,
  meta,
  className,
}: {
  title: string;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-1 text-center", className)}>
      <p className="heading text-[20px] leading-tight">{title}</p>
      {meta ? <div className="label-micro">{meta}</div> : null}
    </div>
  );
}

function ReceiptRule({ className }: { className?: string }) {
  return <hr className={cn("rule my-4", className)} />;
}

/**
 * One ledger line: label · dotted leader · figure.
 * The leader is what makes a receipt read as a receipt.
 */
function ReceiptRow({
  label,
  value,
  hint,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div className="flex items-baseline">
        <span className="text-[13px] text-[hsl(var(--muted-foreground))]">{label}</span>
        <span aria-hidden="true" className="leader" />
        <span className="mono text-[14px]">{value}</span>
      </div>
      {hint ? (
        <span className="text-[12px] text-[hsl(var(--muted-foreground))]">{hint}</span>
      ) : null}
    </div>
  );
}

/** The stamped total: the biggest figure on the receipt. */
function ReceiptTotal({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", className)}>
      <span className="label-micro">{label}</span>
      {children}
    </div>
  );
}

/**
 * Deterministic barcode derived from the receipt's serial.
 * Pure function of the input string — no randomness, so SSR and the client
 * always draw the same bars.
 */
function ReceiptBarcode({ serial, className }: { serial: string; className?: string }) {
  const chars = serial.replace(/\s+/g, "").split("");
  const bars = chars.flatMap((char, index) => {
    const code = char.charCodeAt(0) + index;
    return [
      { width: 1 + (code % 3), gap: 1 + ((code >> 2) % 3) },
      { width: 1 + ((code >> 1) % 2), gap: 1 + ((code >> 3) % 2) },
    ];
  });

  return (
    <div className={cn("flex h-10 items-end gap-px", className)} aria-hidden="true">
      {bars.map((bar, index) => (
        <React.Fragment key={index}>
          <span
            className="block h-full bg-[hsl(var(--foreground))]"
            style={{ width: `${bar.width}px` }}
          />
          <span className="block h-full" style={{ width: `${bar.gap}px` }} />
        </React.Fragment>
      ))}
    </div>
  );
}

/** Serial + provenance line — what makes a value auditable. */
function ReceiptSerial({
  serial,
  timestamp,
  className,
}: {
  serial: string;
  timestamp?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <span className="serial">{serial}</span>
      {timestamp ? (
        <span className="mono text-[11px] text-[hsl(var(--muted-foreground))]">{timestamp}</span>
      ) : null}
    </div>
  );
}

/** The guilloche band that runs across the head of a receipt. */
function ReceiptGuilloche({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("h-10 w-full opacity-70", className)}
      style={{
        backgroundImage: "url(/auramint-receipt-edge.svg)",
        backgroundRepeat: "repeat-x",
        backgroundPosition: "center",
        backgroundSize: "auto 100%",
      }}
    />
  );
}

export {
  Receipt,
  ReceiptHeader,
  ReceiptRule,
  ReceiptRow,
  ReceiptTotal,
  ReceiptBarcode,
  ReceiptSerial,
  ReceiptGuilloche,
  Perforation,
};
