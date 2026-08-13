import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const RESULT_LIMIT = 10;

const userSelect = {
  username: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
} satisfies Prisma.ProfileSelect;

export type UserSearchResult = Prisma.ProfileGetPayload<{
  select: typeof userSelect;
}>;

export async function searchUsers(query: string) {
  return prisma.profile.findMany({
    where: {
      OR: [
        { username: { contains: query, mode: "insensitive" } },
        { displayName: { contains: query, mode: "insensitive" } },
      ],
    },
    take: RESULT_LIMIT,
    select: userSelect,
  });
}

const matchSelect = {
  id: true,
  homeTeam: true,
  awayTeam: true,
  competition: true,
  kickoff: true,
  status: true,
} satisfies Prisma.MatchSelect;

export type MatchSearchResult = Prisma.MatchGetPayload<{
  select: typeof matchSelect;
}>;

function matchTextFilter(query: string): Prisma.MatchWhereInput {
  return {
    OR: [
      { homeTeam: { contains: query, mode: "insensitive" } },
      { awayTeam: { contains: query, mode: "insensitive" } },
      { competition: { contains: query, mode: "insensitive" } },
    ],
  };
}

export async function searchMatches(query: string) {
  return prisma.match.findMany({
    where: matchTextFilter(query),
    orderBy: { kickoff: "asc" },
    take: RESULT_LIMIT,
    select: matchSelect,
  });
}

const marketSelect = {
  id: true,
  type: true,
  status: true,
  match: { select: matchSelect },
} satisfies Prisma.MarketSelect;

export type MarketSearchResult = Prisma.MarketGetPayload<{
  select: typeof marketSelect;
}>;

export async function searchMarkets(query: string) {
  return prisma.market.findMany({
    where: { match: matchTextFilter(query) },
    orderBy: { createdAt: "desc" },
    take: RESULT_LIMIT,
    select: marketSelect,
  });
}
