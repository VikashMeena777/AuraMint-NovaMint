"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

/** Engraver's field: solid plate, hairline, patina focus ring. */
function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "aura-input h-11 w-full px-3 text-[14px] outline-none",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "aura-input w-full resize-y p-3 text-[14px] leading-relaxed outline-none",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
}

/**
 * Password field with a labelled visibility toggle.
 * The toggle is a real button with `aria-pressed` and an accessible name, so it
 * is usable by screen readers (the old icon-only buttons had no name at all).
 */
function PasswordInput({
  className,
  visible,
  onVisibleChange,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
}) {
  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-12", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => onVisibleChange(!visible)}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-1.5 top-1.5 inline-flex size-8 items-center justify-center rounded-[var(--radius)] text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export { Input, Textarea, PasswordInput };
