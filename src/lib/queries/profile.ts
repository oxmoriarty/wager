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
  };
}

export type PublicProfile = NonNullable<
  Awaited<ReturnType<typeof getProfileByUsername>>
>;
