import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** How many recent predictions to preview inline on each market card. */
const MARKET_PREDICTIONS_PREVIEW = 3;

const marketPredictionSelect = {
  id: true,
  content: true,
  side: true,
  createdAt: true,
  author: {
    select: {
      profile: {
        select: { username: true, displayName: true, avatarUrl: true },
      },
    },
  },
} satisfies Prisma.PredictionSelect;

const marketSelect = {
  id: true,
  type: true,
  status: true,
  outcome: true,
  settlementConfidence: true,
  settlementSummary: true,
  settledAt: true,
  totalSupportAmount: true,
  totalChallengeAmount: true,
  createdAt: true,
  _count: { select: { predictions: true } },
  predictions: {
    select: marketPredictionSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MARKET_PREDICTIONS_PREVIEW,
  },
} satisfies Prisma.MarketSelect;

const matchSelect = {
  id: true,
  externalId: true,
  competition: true,
  homeTeam: true,
  awayTeam: true,
  kickoff: true,
  status: true,
  homeScore: true,
  awayScore: true,
  markets: {
    select: marketSelect,
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.MatchSelect;

type RawMatch = Prisma.MatchGetPayload<{ select: typeof matchSelect }>;
type RawMarket = RawMatch["markets"][number];
type RawMarketPrediction = RawMarket["predictions"][number];

type FlatAuthor = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type MarketPredictionDetail = Omit<RawMarketPrediction, "author"> & {
  author: FlatAuthor;
};

/** The viewer's own stake on a market, if any — mirrors `feed.ts`'s
 * `isLikedByViewer` pattern: computed separately from the main query
 * (only when a `viewerId` is given) and merged in afterward, rather than
 * joined in the main select, since it's viewer-specific and every other
 * field on `MarketDetail` is not. */
export interface ViewerPosition {
  side: "SUPPORT" | "CHALLENGE";
  amount: string;
  status: string;
}

/** `totalSupportAmount`/`totalChallengeAmount` are Prisma `Decimal` on the
 * wire out of the database. Decimal instances cannot cross a Server ->
 * Client Component boundary (Next.js will throw), so this is the query
 * boundary where they get converted to plain strings — same treatment
 * `Position`/`Transaction` amounts will need once those are read anywhere. */
export type MarketDetail = Omit<
  RawMarket,
  "totalSupportAmount" | "totalChallengeAmount" | "predictions"
> & {
  totalSupportAmount: string;
  totalChallengeAmount: string;
  viewerPosition: ViewerPosition | null;
  predictions: MarketPredictionDetail[];
};

export type MatchDetail = Omit<RawMatch, "markets"> & {
  markets: MarketDetail[];
};

export const getMatchById = cache(
  async (id: string, viewerId?: string): Promise<MatchDetail | null> => {
    const match = await prisma.match.findUnique({
      where: { id },
      select: matchSelect,
    });
    if (!match) return null;

    const viewerPositions =
      viewerId && match.markets.length > 0
        ? await prisma.position.findMany({
            where: {
              userId: viewerId,
              marketId: { in: match.markets.map((m) => m.id) },
            },
            select: { marketId: true, side: true, amount: true, status: true },
          })
        : [];

    const viewerPositionByMarketId = new Map(
      viewerPositions.map((p) => [p.marketId, p]),
    );

    return {
      ...match,
      markets: match.markets.map((market) => {
        const viewerPosition = viewerPositionByMarketId.get(market.id);
        return {
          ...market,
          totalSupportAmount: market.totalSupportAmount.toString(),
          totalChallengeAmount: market.totalChallengeAmount.toString(),
          viewerPosition: viewerPosition
            ? {
                side: viewerPosition.side,
                amount: viewerPosition.amount.toString(),
                status: viewerPosition.status,
              }
            : null,
          predictions: market.predictions.map((p) => ({
            ...p,
            author: {
              username: p.author.profile?.username ?? "",
              displayName: p.author.profile?.displayName ?? "",
              avatarUrl: p.author.profile?.avatarUrl ?? null,
            },
          })),
        };
      }),
    };
  },
);
