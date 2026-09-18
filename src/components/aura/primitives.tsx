"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { polarityRail, TONE } from "./mint";

/* ─────────────────────────────── plate ─────────────────────────────── */

/**
 * Solid engraved plate. Replaces `.glass` / `.glass-card` in every scoped surface so
 * the UI never depends on the legacy blur class. Optional 3px polarity rail carries
 * the W/L signal in greyscale (colour-blind safe).
 */
export function Plate({
  children,
  className,
  rail,
  interactive = false,
  as: Tag = "div",
}: {
  children?: ReactNode;
  className?: string;
  rail?: number | null;
  interactive?: boolean;
  as?: "div" | "article" | "section" | "li";
}) {
  return (
    <Tag
      className={cn(
        TONE.plate,
        "relative overflow-hidden rounded-2xl",
        rail !== null && rail !== undefined && polarityRail(rail),
        interactive && "transition-colors hover:border-[#1F6F5C]/40",
        className
      )}
    >
      {children}
    </Tag>
  );
}

/* ─────────────────────────────── labels ─────────────────────────────── */

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}

export function Chip({
  children,
  className,
  tone = "lead",
}: {
  children: ReactNode;
  className?: string;
  tone?: "pos" | "neg" | "brass" | "lead";
}) {
  const tones = {
    pos: TONE.posBgSoft,
    neg: TONE.negBgSoft,
    brass: TONE.brassBgSoft,
    lead: TONE.leadBgSoft,
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ─────────────────────────────── emoji ─────────────────────────────── */

/**
 * Emoji used as *content* (verdict glyphs, reaction tokens). Emoji are never used for
 * system meaning (tiers/categories/nav use Lucide) and never animated.
 */
export function EmojiMark({
  emoji,
  label,
  className,
}: {
  emoji?: string | null;
  label?: string;
  className?: string;
}) {
  if (!emoji) return null;
  return (
    <span role="img" aria-label={label ?? "aura emoji"} className={cn("inline-block select-none leading-none", className)}>
      {emoji}
    </span>
  );
}

/* ─────────────────────────────── states ─────────────────────────────── */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Plate className={cn("px-6 py-14 text-center", className)}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-secondary/40 text-muted-foreground">
        {icon}
      </div>
      <h3 className="font-display text-xl text-foreground">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground sm:text-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </Plate>
  );
}

export function SkeletonPlate({ className }: { className?: string }) {
  return (
    <div className={cn(TONE.plate, "animate-pulse rounded-2xl", className)} aria-hidden="true" />
  );
}

/* ─────────────────────────────── controls ─────────────────────────────── */

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Required: icon-only controls must have an accessible name. */
  label: string;
  children: ReactNode;
  loading?: boolean;
};

export function IconButton({ label, children, className, loading, disabled, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:text-foreground disabled:opacity-50",
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : children}
    </button>
  );
}

export function PrimaryButton({
  children,
  className,
  loading,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; loading?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] transition-colors disabled:opacity-50",
        TONE.posBg,
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  id,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label: string;
  id?: string;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F6F5C]/50",
        checked ? "border-[#1F6F5C] bg-[#1F6F5C]" : "border-border bg-muted"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block h-4.5 w-4.5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-[3px]"
        )}
      />
    </button>
  );
}
