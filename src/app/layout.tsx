import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "sonner";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
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
      className={`${dmSans.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster
            position="top-center"
            richColors
            closeButton
            toastOptions={{
              style: {
                fontFamily: "var(--font-dm-sans), system-ui",
                borderRadius: "16px",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
