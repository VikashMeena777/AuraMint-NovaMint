import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * SiteFooter — one footer for the marketing and auth surfaces (the old build
 * duplicated the same block three times). Every link resolves to a real route.
 */
export function SiteFooter({ className }: { className?: string }) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn("border-t border-[hsl(var(--border))] bg-[hsl(var(--card))]", className)}
    >
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Link href="/" className="flex items-center gap-2.5" aria-label="AuraMint home">
            <Image
              src="/auramint-coin.svg"
              alt=""
              width={28}
              height={28}
              className="size-7"
              aria-hidden="true"
            />
            <span className="heading text-[20px] text-[color-mix(in_srgb,var(--brass-500)_82%,hsl(var(--foreground)))]">
              AuraMint
            </span>
          </Link>
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            An assay office for social currency. Log a moment, get an AI verdict, keep the
            receipt in a public ledger.
          </p>
        </div>

        <nav aria-label="Product">
          <h2 className="label-micro">Product</h2>
          <ul className="mt-3 flex flex-col gap-2 text-[14px] [&_a]:inline-flex [&_a]:min-h-[32px] [&_a]:items-center">
            <li>
              <Link href="/#assay" className="hover:underline">
                The assay
              </Link>
            </li>
            <li>
              <Link href="/#hallmarks" className="hover:underline">
                Tier hallmarks
              </Link>
            </li>
            <li>
              <Link href="/#premium" className="hover:underline">
                AuraMint+ pricing
              </Link>
            </li>
            <li>
              <Link href="/leaderboard" className="hover:underline">
                Public leaderboard
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Account">
          <h2 className="label-micro">Account</h2>
          <ul className="mt-3 flex flex-col gap-2 text-[14px] [&_a]:inline-flex [&_a]:min-h-[32px] [&_a]:items-center">
            <li>
              <Link href="/login" className="hover:underline">
                Log in
              </Link>
            </li>
            <li>
              <Link href="/signup" className="hover:underline">
                Create an account
              </Link>
            </li>
            <li>
              <Link href="/dashboard" className="hover:underline">
                Your ledger
              </Link>
            </li>
            <li>
              <a
                href="https://novamintnetworks.in"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                NovaMint Networks ↗
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-[hsl(var(--border))]">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-[12px] text-[hsl(var(--muted-foreground))] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {year} AuraMint · NovaMint Networks</p>
          <p className="mono">Prices in INR. International pricing in USD.</p>
        </div>
      </div>
    </footer>
  );
}
