import {
  MarketStatus,
  MarketType,
  MatchStatus,
  PositionStatus,
  PredictionSide,
} from "@prisma/client";
import { TransactionStatus } from "genlayer-js/types";
import { keccak256, toHex } from "viem";
import type { Hex } from "viem";

import { prisma } from "@/lib/prisma";
import { emitSettlementCompleted } from "@/lib/socket/emit";
import { settleMarketOnChain, voidMarketOnChain } from "@/lib/arc/relayer";
import { CONTRACT_SIDE } from "@/lib/arc/abi";
import {
  getGenLayerClient,
  getFixtureDiscoveryAddress,
  getSettlementContractAddress,
} from "./client";

/**
 * Shape returned by the Settlement contract's `get_settlement` view.
 */
interface ContractSettlement {
  fixture_id: string;
  market_type: string;
  outcome: string;
  confidence: number;
  summary: string;
  home_score: number;
  away_score: number;
  sources_checked: number;
  sources_agreeing: number;
  settled_at: string;
}

/**
 * Shape returned by the Fixture Discovery contract's `get_fixture` view.
 */
interface ContractFixture {
  fixture_id: string;
  source_url: string;
}

/**
 * Backend-side confidence threshold — must match the Settlement
 * contract's own MIN_CONFIDENCE (0.8). Checked server-side as an
 * additional guardrail so a misconfigured contract can't slip through.
 */
const MIN_CONFIDENCE = 0.8;

/**
 * Match statuses that make a market eligible for settlement.
 * FINISHED: normal end → settle with verified result.
 * ABANDONED/CANCELED/POSTPONED/SUSPENDED: abnormal end → void.
 */
const SETTLEMENT_ELIGIBLE_MATCH_STATUSES: MatchStatus[] = [
  MatchStatus.FINISHED,
  MatchStatus.ABANDONED,
  MatchStatus.CANCELED,
  MatchStatus.POSTPONED,
  MatchStatus.SUSPENDED,
];

/**
 * Market statuses that can still be settled — once a market is SETTLED
 * or VOID it is terminal and must not be re-settled.
 */
const SETTLEMENT_ELIGIBLE_MARKET_STATUSES: MarketStatus[] = [
  MarketStatus.OPEN,
  MarketStatus.LOCKED,
];

/** Fallback source for multi-source verification — a Google search for
 *  the match, so the LLM can find score data even if the primary source
 *  is down. */
const FALLBACK_SOURCE_URL = "https://www.google.com/search?q=";

/** Maps the Settlement contract's outcome string to an Arc Escrow Side. */
const OUTCOME_TO_SIDE: Record<string, number> = {
  SUPPORT: CONTRACT_SIDE.SUPPORT,
  CHALLENGE: CONTRACT_SIDE.CHALLENGE,
};

/** Maps the Settlement contract's outcome to the PredictionSide that won. */
const OUTCOME_TO_PREDICTION_SIDE: Record<string, PredictionSide> = {
  SUPPORT: PredictionSide.SUPPORT,
  CHALLENGE: PredictionSide.CHALLENGE,
};

/**
 * Settlement sync pipeline (PROJECT.md §6 → §7).
 *
 * For every market that is eligible for settlement (MATCH_RESULT, match
 * in a terminal status, market still OPEN or LOCKED):
 *
 * 1. Reads the fixture's source URL from the Fixture Discovery contract
 * 2. Calls the Settlement contract's `settle_market` write method
 * 3. Waits for GenLayer finality
 * 4. Reads back the settlement record
 * 5. Validates the decision server-side (structural checks, confidence)
 * 6. Relays the decision to Arc Escrow (`settleMarket` / `voidMarket`)
 * 7. Updates Prisma (Market status, Position statuses)
 * 8. Emits `settlement_completed` via Socket.IO
 *
 * Per PROJECT.md §6, this function validates the adjudication decision
 * GenLayer already produced — it never re-derives or second-guesses the
 * truth of the outcome itself.
 */
export async function syncSettlementsFromGenLayer() {
  const client = getGenLayerClient();
  const fixtureDiscoveryAddress = getFixtureDiscoveryAddress();
  const settlementAddress = getSettlementContractAddress();

  const markets = await prisma.market.findMany({
    where: {
      type: MarketType.MATCH_RESULT,
      status: { in: SETTLEMENT_ELIGIBLE_MARKET_STATUSES },
      match: { status: { in: SETTLEMENT_ELIGIBLE_MATCH_STATUSES } },
    },
    include: {
      match: {
        select: {
          id: true,
          externalId: true,
          homeTeam: true,
          awayTeam: true,
          status: true,
          homeScore: true,
          awayScore: true,
        },
      },
    },
  });

  let settledCount = 0;
  let voidedCount = 0;
  let skippedCount = 0;

  for (const market of markets) {
    try {
      const match = market.match;

      // Read the fixture's source URL from Fixture Discovery (same
      // pattern as sync-match-status.ts — the source URL lives in the
      // Fixture Discovery contract, not in Prisma).
      const fixture = (await client.readContract({
        address: fixtureDiscoveryAddress,
        functionName: "get_fixture",
        args: [match.externalId],
      })) as unknown as ContractFixture;

      // Build comma-separated source URLs: primary source + fallback
      const searchQuery = encodeURIComponent(
        `${match.homeTeam} vs ${match.awayTeam} score result`,
      );
      const sourceUrls =
        fixture && fixture.source_url
          ? `${fixture.source_url},${FALLBACK_SOURCE_URL}${searchQuery}`
          : `${FALLBACK_SOURCE_URL}${searchQuery}`;

      // Trigger settlement on the GenLayer Settlement contract
      const txHash = await client.writeContract({
        address: settlementAddress,
        functionName: "settle_market",
        args: [
          match.externalId,
          match.homeTeam,
          match.awayTeam,
          match.status,
          match.homeScore ?? 0,
          match.awayScore ?? 0,
          sourceUrls,
        ],
        value: BigInt(0),
      });

      await client.waitForTransactionReceipt({
        hash: txHash,
        status: TransactionStatus.FINALIZED,
      });

      // Read back the consensus'd settlement decision
      const settlement = (await client.readContract({
        address: settlementAddress,
        functionName: "get_settlement",
        args: [match.externalId],
      })) as unknown as ContractSettlement;

      // --- Server-side validation (PROJECT.md §6) ---

      if (!["SUPPORT", "CHALLENGE", "VOID"].includes(settlement.outcome)) {
        console.error(
          `Settlement returned unrecognized outcome "${settlement.outcome}" ` +
            `for market ${market.id} — skipping`,
        );
        skippedCount += 1;
        continue;
      }

      if (
        settlement.outcome !== "VOID" &&
        settlement.confidence < MIN_CONFIDENCE
      ) {
        console.error(
          `Settlement confidence ${settlement.confidence} is below threshold ` +
            `${MIN_CONFIDENCE} for non-VOID outcome "${settlement.outcome}" ` +
            `on market ${market.id} — skipping`,
        );
        skippedCount += 1;
        continue;
      }

      // Canonical on-chain market ID — must match the derivation in
      // src/lib/arc/relayer.ts and the stake-confirm route.
      const onChainMarketId = keccak256(toHex(market.id)) as Hex;
      const settledAtDate = new Date(settlement.settled_at);

      if (
        settlement.outcome === "SUPPORT" ||
        settlement.outcome === "CHALLENGE"
      ) {
        const winningSide = OUTCOME_TO_SIDE[settlement.outcome];
        const winningSidePrediction =
          OUTCOME_TO_PREDICTION_SIDE[settlement.outcome];

        // Relay to Arc Escrow
        await settleMarketOnChain(onChainMarketId, winningSide);

        // Atomic Prisma update: market + position statuses
        await prisma.$transaction([
          prisma.market.update({
            where: { id: market.id },
            data: {
              status: MarketStatus.SETTLED,
              outcome: settlement.outcome,
              settlementConfidence: settlement.confidence,
              settlementSummary: settlement.summary,
              settlementTxHash: txHash,
              settledAt: settledAtDate,
            },
          }),
          prisma.position.updateMany({
            where: { marketId: market.id, side: winningSidePrediction },
            data: { status: PositionStatus.WON },
          }),
          prisma.position.updateMany({
            where: {
              marketId: market.id,
              side: { not: winningSidePrediction },
            },
            data: { status: PositionStatus.LOST },
          }),
        ]);

        emitSettlementCompleted({
          marketId: market.id,
          outcome: settlement.outcome,
          settledAt: settledAtDate.toISOString(),
        });

        settledCount += 1;
      } else {
        // VOID — full refund path
        await voidMarketOnChain(onChainMarketId);

        await prisma.$transaction([
          prisma.market.update({
            where: { id: market.id },
            data: {
              status: MarketStatus.VOID,
              outcome: "VOID",
              settlementConfidence: settlement.confidence,
              settlementSummary: settlement.summary,
              settlementTxHash: txHash,
              settledAt: settledAtDate,
            },
          }),
          prisma.position.updateMany({
            where: { marketId: market.id },
            data: { status: PositionStatus.VOID },
          }),
        ]);

        emitSettlementCompleted({
          marketId: market.id,
          outcome: "VOID",
          settledAt: settledAtDate.toISOString(),
        });

        voidedCount += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `Settlement sync failed for market ${market.id}: ${message}`,
      );
      skippedCount += 1;
    }
  }

  return { settledCount, voidedCount, skippedCount };
}
