import type { Metadata } from "next";
import DashboardClient from "./dashboard-client";

export const metadata: Metadata = {
  title: "The Ledger",
  description: "Every aura moment, minted and ranked. Vote W or L, react, and boost your best entries.",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
