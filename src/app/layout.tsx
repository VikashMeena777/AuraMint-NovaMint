import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Syne, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "sonner";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "AuraMint — Track Your Aura Energy 👑",
    template: "%s | AuraMint",
  },
  description:
    "AI-powered aura scoring for Gen-Z. Log daily moments, get dramatic Hinglish verdicts, compete on leaderboards. From NPC to GOD MODE.",
  keywords: ["aura tracker", "aura points", "gen z app", "aura meme", "main character energy"],
  authors: [{ name: "NovaMint Networks" }],
  openGraph: {
    title: "AuraMint — Track Your Aura Energy 👑",
    description: "AI rates your life moments with savage aura points. Compete. Share. Go viral.",
    url: "https://auramint.novamintnetworks.in",
    siteName: "AuraMint",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AuraMint — Track Your Aura Energy 👑",
    description: "AI-powered aura scoring. Log moments. Get roasted. Go viral.",
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://auramint.novamintnetworks.in"
  ),
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
      className={`${plusJakartaSans.variable} ${syne.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] antialiased relative">
        {/* Global tactile grain overlay */}
        <div className="pointer-events-none fixed inset-0 z-50 grain opacity-[0.02] dark:opacity-[0.035] mix-blend-overlay" />

        {/* Animated Premium Backdrop Light Leaks */}
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          {/* Orb 1: Golden Aura */}
          <div className="orb-drift-1 absolute -top-60 -left-60 h-[850px] w-[850px] rounded-full bg-gradient-to-br from-amber-500/18 via-orange-500/18 to-rose-500/8 blur-[130px] opacity-80" />
          {/* Orb 2: Purple Aura */}
          <div className="orb-drift-2 absolute -bottom-60 -right-60 h-[900px] w-[900px] rounded-full bg-gradient-to-br from-indigo-500/18 via-purple-500/18 to-pink-500/8 blur-[130px] opacity-80" />
          {/* Orb 3: Cosmic Teal */}
          <div className="orb-drift-3 absolute top-1/3 left-1/3 h-[700px] w-[700px] rounded-full bg-gradient-to-br from-teal-500/10 via-emerald-500/8 to-cyan-500/8 blur-[150px] opacity-60" />
        </div>

        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <div className="relative z-10">{children}</div>
          <Toaster
            position="top-center"
            richColors
            closeButton
            toastOptions={{
              style: {
                fontFamily: "var(--font-plus-jakarta-sans), system-ui",
                borderRadius: "16px",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
