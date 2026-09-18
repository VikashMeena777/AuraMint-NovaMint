import type { Metadata } from "next";
import LeaderboardClient from "./leaderboard-client";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Today, this week and all-time aura rankings — struck under each holder's name.",
};

export default function LeaderboardPage() {
  return <LeaderboardClient />;
}
