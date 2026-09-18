import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { MotionProvider } from "@/components/providers/motion-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import "./globals.css";

/**
 * Type system — three faces, one job each:
 * - Instrument Serif  → display (page titles, tier names, struck figures)
 * - Instrument Sans   → UI and body
 * - JetBrains Mono    → every ledger figure, tabular
 * Weights are limited to what the UI actually uses: font files are the single
 * biggest asset cost on the mid-range Android devices most of our users hold.
 */
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://auramint.novamintnetworks.in";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "AuraMint — get your aura minted",
    template: "%s · AuraMint",
  },
  description:
    "Log a life moment, get an AI verdict and an aura figure, then keep it in a public ledger. Eight tiers, from Negative Aura to GOD MODE. Free to start, no card.",
  keywords: ["aura tracker", "aura points", "ai verdicts", "aura leaderboard", "hindlish"],
  authors: [{ name: "NovaMint Networks" }],
  openGraph: {
    title: "AuraMint — get your aura minted",
    description:
      "Every moment has an aura. Log it, get it assayed, and keep the receipt in a public ledger.",
    url: appUrl,
    siteName: "AuraMint",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AuraMint — get your aura minted",
    description: "Log a moment. Get an AI verdict. Keep the receipt.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Chrome Android: shrink the layout viewport when the on-screen keyboard opens,
  // so full-height dialogs (the aura composer) stay on screen while typing.
  // Ignored by browsers that don't support it.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4EFE3" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0E0C" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrumentSerif.variable} ${instrumentSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen antialiased">
        <a className="skip-link" href="#content">
          Skip to content
        </a>

        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <MotionProvider>
            <SessionProvider>
              <div className="relative z-10">{children}</div>
            </SessionProvider>
          </MotionProvider>

          <Toaster
            position="top-center"
            closeButton
            toastOptions={{
              style: {
                fontFamily: "var(--font-instrument-sans), system-ui, sans-serif",
                fontSize: "14px",
                borderRadius: "4px",
                background: "hsl(var(--card))",
                color: "hsl(var(--foreground))",
                border: "1px solid hsl(var(--border))",
                boxShadow: "0 1px 2px hsl(var(--background))",
              },
              classNames: {
                actionButton: "!bg-[hsl(var(--primary))] !text-[hsl(var(--primary-foreground))]",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
