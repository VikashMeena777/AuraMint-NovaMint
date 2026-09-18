import type { Metadata } from "next";
import WrappedClient from "./wrapped-client";

export const metadata: Metadata = {
  title: "Aura Wrapped",
  description: "Your last 30 days of aura, minted into a shareable recap.",
};

export default function WrappedPage() {
  return <WrappedClient />;
}
