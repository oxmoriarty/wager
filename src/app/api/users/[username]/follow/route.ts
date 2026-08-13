import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { emitFollowAdded, emitNotificationCreated } from "@/lib/socket/emit";

async function resolveTarget(username: string) {
  return prisma.profile.findUnique({
    where: { username },
    select: { userId: true, username: true },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return apiError("You must be signed in.", 401, "UNAUTHENTICATED");
  }

  const { username } = await params;
  const target = await resolveTarget(username);
  if (!target) {
    return apiError("User not found.", 404, "NOT_FOUND");
  }

  if (target.userId === session.user.id) {
    return apiError("You can't follow yourself.", 422, "SELF_FOLLOW");
  }

  try {
    await prisma.follow.create({
      data: { followerId: session.user.id, followingId: target.userId },
    });
  } catch (error) {
    // Already following — treat as a no-op success, not an error. Follow
    // is conceptually idempotent from the user's point of view.
    const alreadyFollowing =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002";

    if (!alreadyFollowing) {
      console.error("Follow failed:", error);
      return apiError(
        "Something went wrong. Please try again.",
        500,
        "INTERNAL_ERROR",
      );
    }
  }

  const [follower, followerCount] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { displayName: true },
    }),
    prisma.follow.count({ where: { followingId: target.userId } }),
  ]);

  const notification = await prisma.notification.create({
    data: {
      userId: target.userId,
      actorId: session.user.id,
      type: "FOLLOW",
      message: `${follower?.displayName ?? "Someone"} started following you.`,
    },
  });

  emitFollowAdded({ followerId: session.user.id, followingId: target.userId });
  emitNotificationCreated({
    notificationId: notification.id,
    userId: target.userId,
    type: notification.type,
    message: notification.message,
    createdAt: notification.createdAt.toISOString(),
  });

  return apiSuccess({ following: true, followerCount }, "Followed.");
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return apiError("You must be signed in.", 401, "UNAUTHENTICATED");
  }

  const { username } = await params;
  const target = await resolveTarget(username);
  if (!target) {
    return apiError("User not found.", 404, "NOT_FOUND");
  }

  // Not following in the first place — also a no-op success.
  await prisma.follow.deleteMany({
    where: { followerId: session.user.id, followingId: target.userId },
  });

  const followerCount = await prisma.follow.count({
    where: { followingId: target.userId },
  });

  return apiSuccess({ following: false, followerCount }, "Unfollowed.");
}
