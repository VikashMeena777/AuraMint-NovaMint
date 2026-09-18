"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, ArrowLeft } from "lucide-react";
import { Plate, PrimaryButton } from "@/components/aura/primitives";

/**
 * Route-group error boundary. Next 16 passes `unstable_retry` (not `reset`) — see
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`.
 */
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[app] segment error", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-16">
      <Plate className="p-6 text-center">
        <h2 className="font-display text-2xl text-foreground">The ledger hit a snag</h2>
        <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
          This section failed to load. Your aura balance is safe — retry, or head back to the feed.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
            ref {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <PrimaryButton onClick={() => unstable_retry()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </PrimaryButton>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to feed
          </Link>
        </div>
      </Plate>
    </div>
  );
}
