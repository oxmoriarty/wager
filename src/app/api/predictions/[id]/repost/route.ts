import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { emitNotificationCreated, emitRepostAdded } from "@/lib/socket/emit";

async function resolvePrediction(id: string) {
  return prisma.prediction.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return apiError("You must be signed in.", 401, "UNAUTHENTICATED");
  }

  const { id } = await params;
  const prediction = await resolvePrediction(id);
  if (!prediction) {
    return apiError("Prediction not found.", 404, "NOT_FOUND");
  }

  try {
    await prisma.repost.create({
      data: { userId: session.user.id, predictionId: prediction.id },
    });
  } catch (error) {
    // Already reposted — idempotent no-op, not an error.
    const alreadyReposted =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002";

    if (!alreadyReposted) {
      console.error("Repost failed:", error);
      return apiError(
        "Something went wrong. Please try again.",
        500,
        "INTERNAL_ERROR",
      );
    }
  }

  const repostCount = await prisma.repost.count({
    where: { predictionId: prediction.id },
  });

  emitRepostAdded({
    predictionId: prediction.id,
    userId: session.user.id,
    repostCount,
  });

  if (prediction.authorId !== session.user.id) {
    const reposter = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { displayName: true },
    });

    const notification = await prisma.notification.create({
      data: {
        userId: prediction.authorId,
        actorId: session.user.id,
        type: "REPOST",
        predictionId: prediction.id,
        message: `${reposter?.displayName ?? "Someone"} reposted your prediction.`,
      },
    });

    emitNotificationCreated({
      notificationId: notification.id,
      userId: prediction.authorId,
      type: notification.type,
      message: notification.message,
      createdAt: notification.createdAt.toISOString(),
    });
  }

  return apiSuccess({ reposted: true, repostCount }, "Reposted.");
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return apiError("You must be signed in.", 401, "UNAUTHENTICATED");
  }

  const { id } = await params;
  const prediction = await resolvePrediction(id);
  if (!prediction) {
    return apiError("Prediction not found.", 404, "NOT_FOUND");
  }

  await prisma.repost.deleteMany({
    where: { userId: session.user.id, predictionId: prediction.id },
  });

  const repostCount = await prisma.repost.count({
    where: { predictionId: prediction.id },
  });

  emitRepostAdded({
    predictionId: prediction.id,
    userId: session.user.id,
    repostCount,
  });

  return apiSuccess({ reposted: false, repostCount }, "Removed repost.");
}
