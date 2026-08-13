import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const FEED_PAGE_SIZE = 20;

const predictionSelect = {
  id: true,
  content: true,
  side: true,
  createdAt: true,
  author: {
    select: { username: true, displayName: true, avatarUrl: true },
  },
  market: {
    select: {
      id: true,
      type: true,
      match: {
        select: {
          id: true,
          homeTeam: true,
          awayTeam: true,
          competition: true,
          kickoff: true,
          status: true,
        },
      },
    },
  },
  _count: { select: { likes: true, comments: true, reposts: true } },
} satisfies Prisma.PredictionSelect;

type PredictionRow = Prisma.PredictionGetPayload<{
  select: typeof predictionSelect;
}>;

/** Attaches `isLikedByViewer`/`isRepostedByViewer` for the given viewer. */
async function withViewerState(
  predictions: PredictionRow[],
  viewerId?: string,
) {
  if (!viewerId || predictions.length === 0) {
    return predictions.map((p) => ({
      ...p,
      isLikedByViewer: false,
      isRepostedByViewer: false,
    }));
  }

  const predictionIds = predictions.map((p) => p.id);
  const [likedRows, repostedRows] = await Promise.all([
    prisma.like.findMany({
      where: { userId: viewerId, predictionId: { in: predictionIds } },
      select: { predictionId: true },
    }),
    prisma.repost.findMany({
      where: { userId: viewerId, predictionId: { in: predictionIds } },
      select: { predictionId: true },
    }),
  ]);
  const likedIds = new Set(likedRows.map((row) => row.predictionId));
  const repostedIds = new Set(repostedRows.map((row) => row.predictionId));

  return predictions.map((p) => ({
    ...p,
    isLikedByViewer: likedIds.has(p.id),
    isRepostedByViewer: repostedIds.has(p.id),
  }));
}

export async function getFeedPage(cursor?: string, viewerId?: string) {
  const predictions = await prisma.prediction.findMany({
    take: FEED_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: predictionSelect,
  });

  const hasMore = predictions.length > FEED_PAGE_SIZE;
  const page = hasMore ? predictions.slice(0, FEED_PAGE_SIZE) : predictions;
  const items = await withViewerState(page, viewerId);

  return {
    items,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

export type FeedItem = Awaited<ReturnType<typeof getFeedPage>>["items"][number];

export async function getPredictionsByAuthor(
  authorId: string,
  viewerId?: string,
) {
  const predictions = await prisma.prediction.findMany({
    where: { authorId },
    take: FEED_PAGE_SIZE,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: predictionSelect,
  });

  return withViewerState(predictions, viewerId);
}

export async function getPredictionById(id: string, viewerId?: string) {
  const prediction = await prisma.prediction.findUnique({
    where: { id },
    select: predictionSelect,
  });
  if (!prediction) return null;

  const [withState] = await withViewerState([prediction], viewerId);
  return withState;
}

export async function getOpenMarketsForComposer() {
  return prisma.market.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      match: {
        select: { homeTeam: true, awayTeam: true, competition: true },
      },
    },
  });
}

export type ComposerMarket = Awaited<
  ReturnType<typeof getOpenMarketsForComposer>
>[number];
