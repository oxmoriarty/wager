import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function getProfileByUsername(username: string) {
  const profile = await prisma.profile.findUnique({
    where: { username },
    select: {
      userId: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      createdAt: true,
      user: {
        select: {
          _count: {
            select: {
              predictions: true,
              following: true,
              followers: true,
            },
          },
        },
      },
    },
  });

  if (!profile) return null;

  // DB-sourced reward stats — derived from Position + Transaction tables
  // which are updated atomically during claim-confirm (verified on-chain
  // before writing). No RPC calls needed.
  const [positionStats, claimStats] = await Promise.all([
    prisma.position.groupBy({
      by: ["status"],
      where: { userId: profile.userId },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: {
        userId: profile.userId,
        type: "CLAIM",
        status: "CONFIRMED",
      },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const statusCounts = Object.fromEntries(
    positionStats.map((s) => [s.status, s._count]),
  ) as Record<string, number>;

  const totalWins = (statusCounts["WON"] ?? 0) + (statusCounts["CLAIMED"] ?? 0);
  const resolvedPositions =
    totalWins +
    (statusCounts["LOST"] ?? 0) +
    (statusCounts["VOID"] ?? 0);

  return {
    userId: profile.userId,
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    memberSince: profile.createdAt,
    predictionCount: profile.user._count.predictions,
    followerCount: profile.user._count.followers,
    followingCount: profile.user._count.following,
    totalWins,
    totalClaimed: (claimStats._sum.amount ?? new Prisma.Decimal(0)).toString(),
    winRate: resolvedPositions > 0 ? totalWins / resolvedPositions : 0,
  };
}

export type PublicProfile = NonNullable<
  Awaited<ReturnType<typeof getProfileByUsername>>
>;

