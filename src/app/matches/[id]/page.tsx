import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMatchById } from "@/lib/queries/match";
import { AppHeader } from "@/components/layout/app-header";
import { MatchHeader } from "@/components/match/match-header";
import { MarketCard } from "@/components/match/market-card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const match = await getMatchById(id);

  if (!match) return { title: "Match not found" };

  return {
    title: `${match.homeTeam} vs ${match.awayTeam}`,
    description: `${match.competition} — prediction markets on Wager.`,
  };
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const match = await getMatchById(id, session?.user?.id);

  if (!match) {
    notFound();
  }

  const hasWallet = session?.user
    ? Boolean(
        (
          await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { arcWalletAddress: true },
          })
        )?.arcWalletAddress,
      )
    : false;

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8 sm:px-6">
        <MatchHeader
          matchId={match.id}
          competition={match.competition}
          homeTeam={match.homeTeam}
          awayTeam={match.awayTeam}
          kickoff={match.kickoff}
          status={match.status}
          homeScore={match.homeScore}
          awayScore={match.awayScore}
        />

        <div className="flex flex-col gap-3">
          <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Markets
          </h2>
          {match.markets.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No markets have been created for this match yet.
            </p>
          ) : (
            match.markets.map((market) => (
              <MarketCard
                key={market.id}
                market={market}
                isSignedIn={Boolean(session?.user)}
                hasWallet={hasWallet}
              />
            ))
          )}
        </div>
      </main>
    </>
  );
}
