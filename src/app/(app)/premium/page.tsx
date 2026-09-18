import type { Metadata } from "next";
import { Suspense } from "react";
import PremiumClient from "./premium-client";
import { Plate } from "@/components/aura/primitives";

export const metadata: Metadata = {
  title: "AuraMint+",
  description: "Unlimited minting, the sharpest verdicts and a share card worth screenshotting — ₹99/month.",
};

export default function PremiumPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl space-y-5" aria-busy="true">
          <Plate className="h-28 animate-pulse" />
          <Plate className="h-80 animate-pulse" />
        </div>
      }
    >
      <PremiumClient />
    </Suspense>
  );
}
