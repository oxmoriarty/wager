import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { emitLikeAdded, emitNotificationCreated } from "@/lib/socket/emit";

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
    await prisma.like.create({
      data: { userId: session.user.id, predictionId: prediction.id },
    });
  } catch (error) {
    // Already liked — idempotent no-op, not an error.
    const alreadyLiked =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002";

    if (!alreadyLiked) {
      console.error("Like failed:", error);
      return apiError(
        "Something went wrong. Please try again.",
        500,
        "INTERNAL_ERROR",
      );
    }
  }

  const likeCount = await prisma.like.count({
    where: { predictionId: prediction.id },
  });

  emitLikeAdded({
    predictionId: prediction.id,
    userId: session.user.id,
    likeCount,
  });

  if (prediction.authorId !== session.user.id) {
    const liker = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { displayName: true },
    });

    const notification = await prisma.notification.create({
      data: {
        userId: prediction.authorId,
        actorId: session.user.id,
        type: "LIKE",
        predictionId: prediction.id,
        message: `${liker?.displayName ?? "Someone"} liked your prediction.`,
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

  return apiSuccess({ liked: true, likeCount }, "Liked.");
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

  await prisma.like.deleteMany({
    where: { userId: session.user.id, predictionId: prediction.id },
  });

  const likeCount = await prisma.like.count({
    where: { predictionId: prediction.id },
  });

  emitLikeAdded({
    predictionId: prediction.id,
    userId: session.user.id,
    likeCount,
  });

  return apiSuccess({ liked: false, likeCount }, "Unliked.");
}
