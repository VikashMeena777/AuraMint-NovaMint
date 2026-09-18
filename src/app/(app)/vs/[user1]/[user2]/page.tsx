import type { Metadata } from "next";
import DuelClient from "./duel-client";

type Params = Promise<{ user1: string; user2: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { user1, user2 } = await params;
  return {
    title: `@${user1} vs @${user2}`,
    description: `Aura duel between @${user1} and @${user2} — lifetime balances, tiers and the ruling.`,
  };
}

export default async function VersusPage({ params }: { params: Params }) {
  const { user1, user2 } = await params;
  return <DuelClient user1={user1} user2={user2} />;
}
