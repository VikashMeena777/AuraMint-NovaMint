import type { Metadata } from "next";
import OnboardingClient from "./onboarding-client";

export const metadata: Metadata = {
  title: "Get started",
  description: "Claim your handle and learn how aura minting works.",
};

export default function OnboardingPage() {
  return <OnboardingClient />;
}
