"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

/**
 * ThemeToggle.
 *
 * Both glyphs are rendered and revealed by CSS (`dark:` variants) rather than
 * by a "mounted" flag, so there is no hydration mismatch and no setState-in-
 * effect. The button always carries a stable accessible name; the visible
 * label is optional for places where the control stands alone.
 */
export function ThemeToggle({
  className,
  withLabel = false,
}: {
  className?: string;
  withLabel?: boolean;
}) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label="Toggle colour theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-[14px] font-semibold text-[hsl(var(--muted-foreground))] transition-colors",
        "hover:border-[hsl(var(--muted-foreground)/0.55)] hover:text-[hsl(var(--foreground))]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]",
        !withLabel && "size-11 px-0",
        className
      )}
    >
      <Sun className="hidden size-4 dark:block" aria-hidden="true" strokeWidth={1.75} />
      <Moon className="block size-4 dark:hidden" aria-hidden="true" strokeWidth={1.75} />
      {withLabel ? <span>Theme</span> : null}
    </button>
  );
}
