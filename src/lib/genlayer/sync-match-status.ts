import { MatchStatus } from "@prisma/client";
import { TransactionStatus } from "genlayer-js/types";

import { prisma } from "@/lib/prisma";
import { emitScoreUpdated } from "@/lib/socket/emit";
import {
  getGenLayerClient,
  getFixtureDiscoveryAddress,
  getMatchMonitoringAddress,
} from "./client";

// Matches in any of these statuses can still change (a scheduled match
// kicks off, a live match progresses, a postponed/suspended match
// resolves). FINISHED/ABANDONED/CANCELED are terminal and are not
// rechecked.
const NON_TERMINAL_STATUSES: MatchStatus[] = [
  MatchStatus.SCHEDULED,
  MatchStatus.LIVE,
  MatchStatus.POSTPONED,
  MatchStatus.SUSPENDED,
];

const ALLOWED_MATCH_STATUSES = new Set(Object.values(MatchStatus));

interface ContractFixture {
  fixture_id: string;
  source_url: string;
}

interface ContractMatchState {
  fixture_id: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  last_checked_at: string;
}

/**
 * For every Match still in a non-terminal state, reads its source URL
 * from the Fixture Discovery contract, asks the Match Monitoring
 * contract for its current status/score, and — only if something
 * actually changed — updates Postgres and emits `score_updated`.
 *
 * Per PROJECT.md §6, this function relays the Match Monitoring
 * contract's already-consensus'd state; it never independently decides
 * what a match's current score or status is.
 */
export async function syncMatchStatusesFromGenLayer() {
  const client = getGenLayerClient();
  const fixtureDiscoveryAddress = getFixtureDiscoveryAddress();
  const matchMonitoringAddress = getMatchMonitoringAddress();

  const matches = await prisma.match.findMany({
    where: { status: { in: NON_TERMINAL_STATUSES } },
    select: {
      id: true,
      externalId: true,
      homeTeam: true,
      awayTeam: true,
      status: true,
      homeScore: true,
      awayScore: true,
    },
  });

  let updatedCount = 0;
  let uncheckedCount = 0;

  for (const match of matches) {
    const fixture = (await client.readContract({
      address: fixtureDiscoveryAddress,
      functionName: "get_fixture",
      args: [match.externalId],
    })) as unknown as ContractFixture;

    if (!fixture || !fixture.source_url) {
      // Fixture Discovery doesn't know this fixture (e.g. it was
      // created via prisma/seed.ts rather than the real contract, or
      // predates that contract's deployment). Nothing to check it
      // against — skip rather than fail the whole sync run.
      uncheckedCount += 1;
      continue;
    }

    const txHash = await client.writeContract({
      address: matchMonitoringAddress,
      functionName: "check_match",
      args: [
        match.externalId,
        match.homeTeam,
        match.awayTeam,
        fixture.source_url,
      ],
      value: BigInt(0),
    });

    await client.waitForTransactionReceipt({
      hash: txHash,
      status: TransactionStatus.FINALIZED,
    });

    const state = (await client.readContract({
      address: matchMonitoringAddress,
      functionName: "get_match_state",
      args: [match.externalId],
    })) as unknown as ContractMatchState;

    if (!state || !ALLOWED_MATCH_STATUSES.has(state.status as MatchStatus)) {
      console.error(
        `Match Monitoring returned an unrecognized status for ${match.externalId}: ${state?.status}`,
      );
      continue;
    }

    const nextStatus = state.status as MatchStatus;
    const nextHomeScore = state.home_score;
    const nextAwayScore = state.away_score;

    const hasChanged =
      nextStatus !== match.status ||
      nextHomeScore !== match.homeScore ||
      nextAwayScore !== match.awayScore;

    if (!hasChanged) continue;

    await prisma.match.update({
      where: { id: match.id },
      data: {
        status: nextStatus,
        homeScore: nextHomeScore,
        awayScore: nextAwayScore,
      },
    });

    emitScoreUpdated({
      matchId: match.id,
      homeScore: nextHomeScore ?? 0,
      awayScore: nextAwayScore ?? 0,
      status: nextStatus,
    });

    updatedCount += 1;
  }

  return {
    checkedCount: matches.length - uncheckedCount,
    updatedCount,
    uncheckedCount,
  };
}
