import { TransactionStatus } from "genlayer-js/types";

import { prisma } from "@/lib/prisma";
import { getGenLayerClient, getFixtureDiscoveryAddress } from "./client";

interface ContractFixture {
  fixture_id: string;
  competition: string;
  home_team: string;
  away_team: string;
  kickoff_iso: string;
  status: string;
  source_url: string;
  discovered_at: string;
}

/**
 * Triggers the Fixture Discovery Intelligent Contract's `discover_fixtures`
 * write method for a given competition/source, waits for finalization,
 * then reads back every fixture the contract knows about and upserts it
 * into Wager's own `Match`/`Market` tables.
 *
 * Per PROJECT.md §6, this function never decides what counts as a valid
 * fixture — that reasoning happens inside the contract (LLM extraction +
 * validator consensus). This is purely a relay: read the contract's
 * already-agreed-upon state and mirror it into Postgres so the rest of
 * the app (which only ever queries Prisma, never GenLayer directly) sees
 * it.
 */
export async function syncFixturesFromGenLayer(
  competition: string,
  sourceUrl: string,
) {
  const client = getGenLayerClient();
  const address = getFixtureDiscoveryAddress();

  const txHash = await client.writeContract({
    address,
    functionName: "discover_fixtures",
    args: [competition, sourceUrl],
    value: BigInt(0),
  });

  await client.waitForTransactionReceipt({
    hash: txHash,
    status: TransactionStatus.FINALIZED,
  });

  const fixtureIds = (await client.readContract({
    address,
    functionName: "get_fixture_ids",
    args: [],
  })) as string[];

  let syncedCount = 0;

  for (const fixtureId of fixtureIds) {
    const fixture = (await client.readContract({
      address,
      functionName: "get_fixture",
      args: [fixtureId],
    })) as unknown as ContractFixture;

    if (!fixture || !fixture.fixture_id) continue;

    const kickoff = new Date(fixture.kickoff_iso);
    if (Number.isNaN(kickoff.getTime())) {
      console.error(
        `Skipping fixture ${fixtureId}: invalid kickoff_iso "${fixture.kickoff_iso}"`,
      );
      continue;
    }

    const match = await prisma.match.upsert({
      where: { externalId: fixture.fixture_id },
      update: {
        homeTeam: fixture.home_team,
        awayTeam: fixture.away_team,
        kickoff,
      },
      create: {
        externalId: fixture.fixture_id,
        competition: fixture.competition,
        homeTeam: fixture.home_team,
        awayTeam: fixture.away_team,
        kickoff,
        status: "SCHEDULED",
      },
    });

    await prisma.market.upsert({
      where: { matchId_type: { matchId: match.id, type: "MATCH_RESULT" } },
      update: {},
      create: {
        matchId: match.id,
        type: "MATCH_RESULT",
        status: "OPEN",
      },
    });

    syncedCount += 1;
  }

  return { txHash, syncedCount, totalFixturesOnChain: fixtureIds.length };
}
