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
        dur: `${2 + Math.random() * 4}s`,
        del: `${Math.random() * 3}s`,
        size: `${1 + Math.random() * 1.5}px`,
      })),
    []
  );

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Background stars */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {stars.map((s, i) => (
          <div
            key={i}
            className="star absolute rounded-full bg-primary/30"
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

      {/* Gradient orbs */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/10 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
