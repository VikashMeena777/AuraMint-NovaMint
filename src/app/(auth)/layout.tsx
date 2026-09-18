import Image from "next/image";
import Link from "next/link";
import { BookOpenText, Gauge, ShieldCheck } from "lucide-react";

import { SiteFooter } from "@/components/layouts/site-footer";

/**
 * Auth shell — a banknote vignette, not a starfield.
 *
 * A Server Component on purpose: the previous version generated 40 random
 * "stars" during render, which is both a hydration mismatch and a lint error
 * (`react-hooks/purity`). The frame is now static, drawn from the engraved
 * rosette asset, and the plate holds the form.
 */
const assurances = [
  { icon: Gauge, title: "Your own aura total", body: "Every entry moves one number. No per-post metrics to farm." },
  { icon: BookOpenText, title: "A ledger, not a feed", body: "Entries are serial-numbered and kept, so progress is visible." },
  { icon: ShieldCheck, title: "No card, no dark patterns", body: "Free plan: 5 entries a day. Upgrade only if you want the ceiling removed." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div aria-hidden="true" className="guilloche pointer-events-none fixed inset-0 z-0" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:gap-16 lg:py-14">
        {/* ── Brand panel ─────────────────────────────────────────────── */}
        <section className="lg:flex-1">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 rounded-[var(--radius)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[hsl(var(--ring))]"
            aria-label="AuraMint home"
          >
            <Image
              src="/auramint-coin.svg"
              alt=""
              width={28}
              height={28}
              className="size-7"
              aria-hidden="true"
              priority
            />
            <span className="heading text-[20px] text-[color-mix(in_srgb,var(--brass-500)_82%,hsl(var(--foreground)))]">
              AuraMint
            </span>
          </Link>

          <h1 className="heading mt-6 text-[28px] leading-tight sm:text-[40px]">
            Get your aura minted.
          </h1>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            AuraMint is an assay office for social currency: log a moment, get a verdict, and keep
            the receipt in a ledger that remembers.
          </p>

          <ul className="mt-8 hidden max-w-md flex-col gap-5 lg:flex">
            {assurances.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <Icon
                  className="mt-0.5 size-5 flex-none text-[var(--brass-500)]"
                  aria-hidden="true"
                  strokeWidth={1.75}
                />
                <div>
                  <p className="text-[14px] font-semibold">{title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Form plate ──────────────────────────────────────────────── */}
        <main id="content" className="w-full lg:max-w-[26rem]">
          {children}
        </main>
      </div>

      <SiteFooter className="relative z-10" />
    </div>
  );
}
