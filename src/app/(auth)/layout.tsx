"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Crown } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Generate star positions on client only to avoid hydration mismatch
  const stars = useMemo(
    () =>
      Array.from({ length: 30 }, () => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        dur: `${3 + Math.random() * 4}s`,
        del: `${Math.random() * 3}s`,
        size: `${1 + Math.random() * 1.5}px`,
      })),
    []
  );

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden bg-background px-4 py-8">
      {/* Background elements */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Saturated radial grids */}
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-primary/[0.04] blur-[150px]" />
        <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-accent/[0.04] blur-[150px]" />
        
        {/* Twinkling stars */}
        {stars.map((s, i) => (
          <div
            key={i}
            className="star absolute rounded-full bg-primary/20"
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

      {/* Header Logo */}
      <div className="relative z-10 flex flex-col items-center pt-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 border border-primary/10 shadow-sm">
            <Crown className="h-[20px] w-[20px] text-primary" />
          </div>
          <span className="heading text-2xl tracking-tighter grad-text">AuraMint</span>
        </Link>
      </div>

      {/* Main card box container */}
      <div className="relative z-10 my-auto w-full max-w-md pt-8 pb-12">
        {children}
      </div>

      {/* Footer copyright */}
      <div className="relative z-10 text-center">
        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/35">
          © {new Date().getFullYear()} AuraMint. All rights reserved.
        </p>
      </div>
    </div>
  );
}
