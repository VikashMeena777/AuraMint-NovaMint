"use client";

import { useMemo } from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Generate star positions on client only to avoid hydration mismatch
  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, () => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        dur: `${3 + Math.random() * 4}s`,
        del: `${Math.random() * 5}s`,
        size: `${1 + Math.random() * 2}px`,
      })),
    []
  );

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-transparent px-4 py-8">
      {/* ═══ Cosmic Background ═══ */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Cosmic gradient mesh */}
        <div className="absolute inset-0 cosmic-mesh animate-breathe opacity-60" />
        {/* Dot grid */}
        <div className="absolute inset-0 dot-grid opacity-30" />
        {/* Floating orbs */}
        <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-primary/15 blur-[100px] animate-breathe" />
        <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-accent/15 blur-[120px] animate-breathe" style={{ animationDelay: "3s" }} />
        <div className="absolute top-1/2 left-3/4 h-48 w-48 rounded-full bg-emerald-500/8 blur-[80px] animate-breathe" style={{ animationDelay: "5s" }} />

        {/* Twinkling stars */}
        {stars.map((s, i) => (
          <div
            key={i}
            className="star absolute rounded-full bg-foreground/20"
            style={{
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              ["--dur" as string]: s.dur,
              ["--del" as string]: s.del,
            }}
          />
        ))}
      </div>

      {/* Main card container — login/signup cards handle their own logo */}
      <div className="relative z-10 w-full max-w-md">
        {children}
      </div>

      {/* Footer */}
      <div className="relative z-10 mt-8 text-center">
        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/30">
          © {new Date().getFullYear()} AuraMint. All rights reserved.
        </p>
      </div>
    </div>
  );
}
