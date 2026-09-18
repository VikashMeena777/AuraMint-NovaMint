"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpenText, Gem, Menu, MoveRight, Sparkles, Stamp, Trophy } from "lucide-react";

import { useSession } from "@/components/providers/session-provider";
import { AnimatedIcon } from "@/components/ui/animated-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogSheetContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const navLinks = [
  { href: "#assay", label: "The assay", icon: Stamp },
  { href: "#how", label: "How it works", icon: BookOpenText },
  { href: "#hallmarks", label: "Hallmarks", icon: Trophy },
  { href: "#premium", label: "Premium", icon: Gem },
];

/**
 * SiteHeader — marketing chrome.
 *
 * Solid ink plate (no blur), one brass hairline, real anchor links, a labelled
 * theme toggle, and a session-aware call to action. On phones the same links
 * open in a Radix sheet, so the marketing nav is a real dialog with focus
 * trapping rather than a hidden list.
 */
export function SiteHeader() {
  const { isAuthenticated } = useSession();
  const [open, setOpen] = React.useState(false);

  const signedIn = isAuthenticated === true;

  return (
    <header className="sticky top-0 z-40 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5 rounded-[var(--radius)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[hsl(var(--ring))]"
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

        <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-[var(--radius)] px-3 py-2 text-[14px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {signedIn ? (
            <Button asChild size="sm" variant="strike" className="hidden sm:inline-flex">
              <Link href="/dashboard">Open the ledger</Link>
            </Button>
          ) : (
            <>
              <Button asChild size="sm" variant="quiet" className="hidden sm:inline-flex">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm" variant="strike" className="hidden sm:inline-flex">
                <Link href="/signup">
                  Start free
                  <AnimatedIcon icon={MoveRight} idiom="slide" className="size-4" />
                </Link>
              </Button>
            </>
          )}

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                variant="plate"
                size="icon"
                className="md:hidden"
                aria-label="Open navigation menu"
                aria-expanded={open}
              >
                <AnimatedIcon icon={Menu} idiom="press" className="size-[18px]" strokeWidth={1.75} />
              </Button>
            </DialogTrigger>
            <DialogSheetContent>
              <DialogTitle className="mb-4 pr-8 text-[20px]">Menu</DialogTitle>
              <nav aria-label="Sections" className="flex flex-col">
                {navLinks.map(({ href, icon: Icon, label }) => (
                  <DialogClose asChild key={href}>
                    <a
                      href={href}
                      className="group flex min-h-12 items-center gap-3 border-b border-[hsl(var(--border))] text-[16px] font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[hsl(var(--ring))]"
                    >
                      <AnimatedIcon
                        icon={Icon}
                        idiom="slide"
                        className="size-4 text-[hsl(var(--muted-foreground))]"
                      />
                      {label}
                    </a>
                  </DialogClose>
                ))}
              </nav>

              <div className="mt-5 flex flex-col gap-2">
                {signedIn ? (
                  <DialogClose asChild>
                    <Button asChild variant="strike" size="lg" className="w-full">
                      <Link href="/dashboard">Open the ledger</Link>
                    </Button>
                  </DialogClose>
                ) : (
                  <>
                    <DialogClose asChild>
                      <Button asChild variant="strike" size="lg" className="w-full">
                        <Link href="/signup">
                          <AnimatedIcon icon={Sparkles} idiom="strike" className="size-4" />
                          Start free
                        </Link>
                      </Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button asChild variant="plate" size="lg" className="w-full">
                        <Link href="/login">Log in</Link>
                      </Button>
                    </DialogClose>
                  </>
                )}
              </div>

              <p className="mt-5 text-[12px] text-[hsl(var(--muted-foreground))]">
                Free forever · no card · 5 aura logs a day
              </p>
            </DialogSheetContent>
          </Dialog>
        </div>
      </div>
      <div aria-hidden="true" className="rule-brass" />
    </header>
  );
}
