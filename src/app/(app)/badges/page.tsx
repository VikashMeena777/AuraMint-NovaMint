import type { Metadata } from "next";
import BadgesClient from "./badges-client";

export const metadata: Metadata = {
  title: "Badges",
  description: "The hallmark sheet — every aura achievement, struck or waiting.",
};

export default function BadgesPage() {
  return <BadgesClient />;
}
