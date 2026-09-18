"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import { useSession } from "@/components/providers/session-provider";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * SessionLink — a link-button whose destination depends on whether the visitor
 * is signed in (e.g. pricing → "Start free" for guests, "Manage plan" → /premium
 * for members). Optimistic: unknown session renders the guest destination.
 */
export function SessionLink({
  guestHref,
  guestLabel,
  memberHref,
  memberLabel,
  variant = "plate",
  size = "lg",
  className,
}: {
  guestHref: string;
  guestLabel: string;
  memberHref: string;
  memberLabel: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const { isAuthenticated } = useSession();
  const isMember = isAuthenticated === true;

  return (
    <Button asChild variant={variant} size={size} className={cn("w-full", className)}>
      <Link href={isMember ? memberHref : guestHref}>
        {isMember ? memberLabel : guestLabel}
      </Link>
    </Button>
  );
}
