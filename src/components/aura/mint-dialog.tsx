"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * AuraMint modal for the aura surfaces.
 *
 * Delegates to the shared `src/components/ui/dialog.tsx` Radix primitives (shell-owned)
 * so every modal in the product gets the same behaviour: `role="dialog"` + `aria-modal`,
 * Escape, focus trap + focus return, and background scroll lock. The three hand-rolled
 * overlays this replaces had none of those.
 *
 * A title is required by contract; when no visible description is passed we still render
 * a screen-reader description so Radix's `aria-describedby` contract is satisfied.
 */
export function MintDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  titleClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("border border-border bg-card", className)}>
        <DialogHeader>
          <DialogTitle className={titleClassName}>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </DialogHeader>

        {children}

        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
