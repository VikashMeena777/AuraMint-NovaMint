"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Command — the shadcn/cmdk idiom, wired to our Dialog primitives.
 *
 * Give the user a real command surface: cmdk owns arrow-key navigation, type
 * filtering, `aria-activedescendant` and Enter-to-select; Radix owns the modal
 * contract (Escape, focus trap, focus return, scroll lock, `aria-modal`).
 */
function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn(
        "flex h-full w-full flex-col overflow-hidden bg-[hsl(var(--card))] text-[hsl(var(--foreground))]",
        className
      )}
      {...props}
    />
  );
}

function CommandDialog({
  title,
  description,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <Dialog {...props}>
      <DialogContent
        showClose={false}
        className={cn("max-w-xl overflow-hidden p-0", className)}
      >
        {/* Radix requires a title for assistive tech even when it is visually
            hidden; the visible affordance is the search field itself. */}
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <Command
          loop
          className="[&_[cmdk-group-heading]]:label-micro [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2"
        >
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] px-4">
      <Search className="size-4 shrink-0 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
      <CommandPrimitive.Input
        className={cn(
          "h-12 w-full bg-transparent text-[14px] outline-none placeholder:text-[hsl(var(--muted-foreground))] disabled:opacity-50",
          className
        )}
        {...props}
      />
      <kbd className="mono hidden shrink-0 rounded-[var(--radius-sm)] border border-[hsl(var(--border))] px-1.5 py-0.5 text-[11px] text-[hsl(var(--muted-foreground))] sm:inline-block">
        Esc
      </kbd>
    </div>
  );
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn("max-h-[min(60svh,22rem)] overflow-y-auto overscroll-contain p-2", className)}
      {...props}
    />
  );
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      className={cn("py-10 text-center text-[13px] text-[hsl(var(--muted-foreground))]", className)}
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn("overflow-hidden py-1 text-[hsl(var(--foreground))]", className)}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      className={cn("my-1 h-px bg-[hsl(var(--border))]", className)}
      {...props}
    />
  );
}

function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-[14px] outline-none",
        "data-[selected=true]:bg-[hsl(var(--secondary))] data-[selected=true]:text-[hsl(var(--foreground))]",
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        className
      )}
      {...props}
    />
  );
}

function CommandShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "mono ml-auto shrink-0 text-[11px] tracking-widest text-[hsl(var(--muted-foreground))]",
        className
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
};
