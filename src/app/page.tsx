import type { Metadata } from "next";
import Link from "next/link";

import { AURA_TIERS } from "@/lib/ai/prompts";
import { MintIcon } from "@/components/icons/mint-icon";
import type { MarkName } from "@/components/icons/registry";
import { SiteFooter } from "@/components/layouts/site-footer";
import { SiteHeader } from "@/components/layouts/site-header";
import { AuraNumber } from "@/components/ui/aura-number";
import { Button } from "@/components/ui/button";
import { AssayDemo } from "@/components/ui/assay-demo";
import { Plate } from "@/components/ui/card";
import { HeroSpecimen, Reveal } from "@/components/ui/mint-motion";
import {
  ReceiptGuilloche,
} from "@/components/ui/receipt";
import { SessionLink } from "@/components/ui/session-link";
import { StepLine } from "@/components/ui/step-line";
import { TierMark } from "@/components/ui/tier-mark";

export const metadata: Metadata = {
  title: "AuraMint — get your aura minted",
  description:
    "Log a life moment, get an AI verdict and an aura figure, and keep the receipt in a public ledger. Eight tiers, from Negative Aura to GOD MODE. Free to start, no card.",
  alternates: { canonical: "/" },
};

/**
 * Icons on this page are named, not imported: a Lucide component reference
 * cannot cross the server → client boundary, so `<MintIcon name="gauge" />`
 * resolves the animated mark on the client side. The names are type-checked
 * against the mark registry, so a typo cannot ship.
 */
const facts: { icon: MarkName; label: string; detail: string }[] = [
  { icon: "layers", label: "8 tiers", detail: "Negative Aura → GOD MODE" },
  { icon: "gauge", label: "±10,000", detail: "aura a single entry can move" },
  { icon: "badge-check", label: "Free forever", detail: "5 logs a day, no card" },
  { icon: "sparkles", label: "Hinglish verdicts", detail: "written to be screenshotted" },
];

const specimenRows = [
  { label: "Paid for everyone's chai", value: "+1,500", tone: "positive" as const },
  { label: "Left the group chat at 2 AM", value: "+900", tone: "positive" as const },
  { label: "Sunglasses, indoors, at night", value: "−800", tone: "negative" as const },
];

/** Deterministic serials: the press advances through them, never randomises. */
const specimenSerials = ["#0048213", "#0048214", "#0048219", "#0048221"];

const annotations: { icon: MarkName; title: string; body: string }[] = [
  {
    icon: "gauge",
    title: "Polarity rail",
    body: "A 3px edge in patina or oxide, plus the explicit sign. Polarity stays readable in greyscale and for colour-blind users.",
  },
  {
    icon: "crown",
    title: "Hallmark",
    body: "The tier sigil is struck into a notched frame, and the same eight marks appear in the feed, the ladder and the leaderboard.",
  },
  {
    icon: "pen-line",
    title: "Verdict",
    body: "Written in the display serif so the sentence reads as a ruling, not as filler copy from a model.",
  },
  {
    icon: "book-open-text",
    title: "Serial + provenance",
    body: "Every entry is numbered and timestamped. It is the difference between a score and a record.",
  },
];

const premiumFeatures: { icon: MarkName; label: string; free: string; plus: string }[] = [
  { icon: "zap", label: "Aura entries", free: "5 a day", plus: "Unlimited" },
  { icon: "sparkles", label: "Verdict tone", free: "Standard", plus: "Extra savage" },
  { icon: "rocket", label: "Event boosts", free: "None", plus: "5 a month" },
  { icon: "trophy", label: "Leaderboard", free: "Ranked", plus: "Priority + crown" },
  { icon: "shield-check", label: "Share cards", free: "Standard", plus: "Premium plates" },
  { icon: "bar-chart", label: "Analytics", free: "Locked", plus: "Full dashboard" },
  { icon: "palette", label: "Themes", free: "Default", plus: "6 exclusives" },
  { icon: "ban", label: "Ads", free: "Banner ads", plus: "Ad-free" },
];

function formatBand(min: number, max: number): string {
  if (min === -Infinity) return "below 0";
  if (max === Infinity) return `${min.toLocaleString("en-IN")} and above`;
  return `${min.toLocaleString("en-IN")} – ${max.toLocaleString("en-IN")}`;
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen">
      <SiteHeader />

      <main id="content">
        {/* ═══ HERO ═══════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden border-b border-[hsl(var(--border))]">
          <div aria-hidden="true" className="guilloche pointer-events-none absolute inset-0" />

          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:py-20">
            <div>
              <p className="label-micro">A mint for social currency</p>
              <h1 className="heading mt-3 text-[40px] leading-[1.03] sm:text-[56px]">
                Every moment has an aura.
                <br />
                <span className="italic text-[color-mix(in_srgb,var(--brass-500)_82%,hsl(var(--foreground)))]">
                  Get it minted.
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                AuraMint turns your day into entries: what you did, what it was worth, and how it
                reads in Hinglish. Logged, assayed, serial-numbered, and filed against a running
                total that decides your tier.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <SessionLink
                  guestHref="/signup"
                  guestLabel="Start minting — free"
                  memberHref="/dashboard"
                  memberLabel="Open your ledger"
                  variant="strike"
                  size="lg"
                  className="sm:w-auto"
                />
                <Button asChild variant="plate" size="lg" className="sm:w-auto">
                  <a href="#assay">
                    Try the assay
                    <MintIcon name="zap" idiom="strike" className="size-4" />
                  </a>
                </Button>
              </div>

              <p className="mt-3 text-[12px] text-[hsl(var(--muted-foreground))]">
                No credit card. No ads on your own feed while you are on AuraMint+.
              </p>

              <dl className="mt-9 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[hsl(var(--border))] pt-6 sm:grid-cols-4">
                {facts.map(({ icon, label, detail }) => (
                  <div key={label}>
                    <dt className="flex items-center gap-1.5 text-[14px] font-semibold">
                      <MintIcon
                        name={icon}
                        idiom="press"
                        className="size-4 text-[var(--brass-500)]"
                      />
                      {label}
                    </dt>
                    <dd className="mt-0.5 text-[12px] text-[hsl(var(--muted-foreground))]">
                      {detail}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* The press + the specimen receipt it prints. */}
            <Reveal className="lg:pl-4" delay={60}>
              <HeroSpecimen rows={specimenRows} total={1600} serials={specimenSerials} />
            </Reveal>
          </div>
        </section>

        {/* ═══ THE ASSAY ══════════════════════════════════════════════ */}
        <section id="assay" className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <Reveal className="max-w-2xl">
              <p className="label-micro flex items-center gap-2">
                <MintIcon name="stamp" idiom="press" className="size-3.5" />
                The assay
              </p>
              <h2 className="heading mt-3 text-[28px] leading-tight sm:text-[40px]">
                Strike a verdict, keep the receipt
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                This is the same shape as the real thing: a moment in, a receipt out. The demo below
                scores locally so you can see the phrasing — the signed-in version runs the live
                verdict, with a serial number and a permanent ledger row.
              </p>
            </Reveal>

            <Reveal delay={80}>
              <AssayDemo className="mt-10" />
            </Reveal>
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═══════════════════════════════════════════ */}
        <section id="how" className="border-b border-[hsl(var(--border))]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <Reveal className="max-w-2xl">
              <p className="label-micro">How it works</p>
              <h2 className="heading mt-3 text-[28px] leading-tight sm:text-[40px]">
                Three steps, one ledger
              </h2>
            </Reveal>

            <Reveal delay={60}>
              <StepLine className="mt-10" />
            </Reveal>

            <Reveal className="mt-12 grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start" delay={120}>
              <Plate rail="brass" className="p-5 sm:p-6">
                <p className="label-micro">Anatomy of a ledger entry</p>
                <h3 className="heading mt-2 text-[20px] leading-tight">
                  &ldquo;Left on read for four hours&rdquo;
                </h3>
                <div className="mt-4 flex items-baseline justify-between gap-4">
                  <AuraNumber value={-1200} size="lg" animateOnChange={false} />
                  <span className="mono text-[12px] text-[hsl(var(--muted-foreground))]">#0031994</span>
                </div>
                <p className="mt-3 font-display text-[16px] italic leading-relaxed">
                  &ldquo;Not a personality. Attitude bohot hai, and the ledger does not forget.&rdquo;
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="label-micro rounded-[var(--radius-sm)] border border-[hsl(var(--border))] px-2 py-1">
                    Social Sin
                  </span>
                  <span className="label-micro rounded-[var(--radius-sm)] border border-[hsl(var(--border))] px-2 py-1">
                    Crush / Dating
                  </span>
                  <span className="label-micro rounded-[var(--radius-sm)] border border-[hsl(var(--border))] px-2 py-1">
                    NPC
                  </span>
                </div>
              </Plate>

              <ul className="flex flex-col gap-4">
                {annotations.map((item) => (
                  <li key={item.title} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex size-7 flex-none items-center justify-center rounded-[var(--radius-sm)] border border-[hsl(var(--border))] text-[var(--brass-500)]"
                    >
                      <MintIcon name={item.icon} idiom="press" className="size-3.5" />
                    </span>
                    <div>
                      <p className="text-[14px] font-semibold">{item.title}</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                        {item.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* ═══ HALLMARKS ══════════════════════════════════════════════ */}
        <section
          id="hallmarks"
          className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]"
        >
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <Reveal className="max-w-2xl">
              <p className="label-micro">The ladder</p>
              <h2 className="heading mt-3 text-[28px] leading-tight sm:text-[40px]">
                Eight hallmarks, one running total
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                Tiers are decided by your lifetime aura total, not by a single good day. Standard
                entries move a total by up to ±10,000, so the ladder is a long game.
              </p>
            </Reveal>

            <ol className="mt-10 grid gap-3 sm:grid-cols-2">
              {AURA_TIERS.map((tier, index) => (
                <li key={tier.name}>
                  <Reveal delay={(index % 2) * 70} className="h-full">
                    <Plate
                      rail={tier.min < 0 ? "negative" : index >= 5 ? "brass" : "none"}
                      className="flex h-full items-center gap-4 p-4 pl-5"
                    >
                      <span className="flex-none">
                        <TierMark tier={tier.name} size={index >= 5 ? "lg" : "md"} />
                      </span>
                      <div className="min-w-0">
                        <p className="heading text-[20px] leading-tight">{tier.name}</p>
                        <p className="mono mt-0.5 text-[12px] text-[hsl(var(--muted-foreground))]">
                          {formatBand(tier.min, tier.max)}
                        </p>
                        <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
                          {tier.description}
                        </p>
                      </div>
                    </Plate>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ═══ PREMIUM ════════════════════════════════════════════════ */}
        <section id="premium" className="border-b border-[hsl(var(--border))]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <Reveal className="max-w-2xl">
              <p className="label-micro">Pricing</p>
              <h2 className="heading mt-3 text-[28px] leading-tight sm:text-[40px]">
                Two plates: the free ledger, and the certificate
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                The free plan is a real plan — five entries a day, the full ladder, the public
                leaderboard. AuraMint+ removes the ceilings.
              </p>
            </Reveal>

            <div className="mt-10 grid gap-5 lg:grid-cols-2">
              <Reveal className="h-full">
                <Plate className="flex h-full flex-col p-5 sm:p-6">
                  <p className="label-micro">Open ledger</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="mono text-[40px] leading-none">₹0</span>
                    <span className="text-[13px] text-[hsl(var(--muted-foreground))]">forever</span>
                  </div>
                  <p className="mt-3 text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                    Everything you need to start a total: entries, verdicts, tiers and the public
                    leaderboard.
                  </p>
                  <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                    {premiumFeatures.map(({ icon, label, free }) => (
                      <li key={label} className="flex items-start gap-2.5 text-[14px]">
                        <MintIcon
                          name={icon}
                          idiom="press"
                          className="mt-0.5 size-4 flex-none text-[hsl(var(--muted-foreground))]"
                        />
                        <span>
                          <span className="text-[hsl(var(--muted-foreground))]">{label}:</span> {free}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6">
                    <SessionLink
                      guestHref="/signup"
                      guestLabel="Create a free account"
                      memberHref="/dashboard"
                      memberLabel="You are on the free ledger"
                      variant="plate"
                    />
                  </div>
                </Plate>
              </Reveal>

              <Reveal delay={90} className="h-full">
                <Plate tone="brass" className="flex h-full flex-col p-5 sm:p-6">
                  <ReceiptGuilloche className="-mx-5 -mt-5 mb-4 sm:-mx-6" />
                  <div className="flex items-center justify-between gap-3">
                    <p className="label-micro">AuraMint+</p>
                    <span className="label-micro label-brass rounded-[var(--radius-sm)] border border-[var(--brass-600)] px-2 py-1">
                      Certificate of unlimited minting
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="mono text-[40px] leading-none">₹99</span>
                    <span className="text-[13px] text-[hsl(var(--muted-foreground))]">
                      / month · $1.99 international
                    </span>
                  </div>
                  <p className="mt-3 text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                    For people who intend to top the ladder: no daily ceiling, a sharper verdict, and
                    the tools to defend the position.
                  </p>
                  <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                    {premiumFeatures.map(({ icon, label, free, plus }) => (
                      <li key={label} className="flex items-start gap-2.5 text-[14px]">
                        <MintIcon
                          name={icon}
                          idiom="press"
                          className="mt-0.5 size-4 flex-none text-[var(--brass-500)]"
                        />
                        <span>
                          <span className="text-[hsl(var(--muted-foreground))]">{label}:</span>{" "}
                          <span className="font-semibold">{plus}</span>
                          <span className="text-[hsl(var(--muted-foreground))]"> (free: {free})</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6">
                    <SessionLink
                      guestHref="/signup"
                      guestLabel="Start free, upgrade any time"
                      memberHref="/premium"
                      memberLabel="Manage your plan"
                      variant="brass"
                    />
                  </div>
                </Plate>
              </Reveal>
            </div>

            <p className="mt-4 text-[12px] text-[hsl(var(--muted-foreground))]">
              Payments are processed by Cashfree. Cancel any time — access runs to the end of the
              paid month.
            </p>
          </div>
        </section>

        {/* ═══ FINAL CTA ══════════════════════════════════════════════ */}
        <section className="relative overflow-hidden">
          <div aria-hidden="true" className="guilloche-corner pointer-events-none absolute inset-0" />
          <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 py-16 text-center sm:px-6 lg:py-24">
            <Reveal className="flex flex-col items-center">
              <span className="hallmark hallmark-lg" aria-hidden="true">
                <MintIcon name="crown" idiom="strike" className="size-6" />
              </span>
              <h2 className="heading mt-5 text-[28px] leading-tight sm:text-[40px]">
                Ready to find out what today was worth?
              </h2>
              <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                Create an account, log your first moment, and let the ledger do the judging. Free to
                start, five entries a day, no card.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <SessionLink
                  guestHref="/signup"
                  guestLabel="Create your account"
                  memberHref="/dashboard"
                  memberLabel="Open your ledger"
                  variant="strike"
                  size="lg"
                  className="sm:w-auto"
                />
                <Button asChild variant="plate" size="lg" className="sm:w-auto">
                  <Link href="/leaderboard">
                    <MintIcon name="eye" idiom="press" className="size-4" />
                    See the public ladder
                  </Link>
                </Button>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
