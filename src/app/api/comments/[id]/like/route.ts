import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { emitNotificationCreated } from "@/lib/socket/emit";

async function resolveComment(id: string) {
  return prisma.comment.findUnique({
    where: { id },
    select: { id: true, authorId: true, predictionId: true },
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
  const comment = await resolveComment(id);
  if (!comment) {
    return apiError("Comment not found.", 404, "NOT_FOUND");
  }

  try {
    await prisma.commentLike.create({
      data: { userId: session.user.id, commentId: comment.id },
    });
  } catch (error) {
    const alreadyLiked =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002";

    if (!alreadyLiked) {
      console.error("Comment like failed:", error);
      return apiError(
        "Something went wrong. Please try again.",
        500,
        "INTERNAL_ERROR",
      );
    }
  }

  const likeCount = await prisma.commentLike.count({
    where: { commentId: comment.id },
  });

  if (comment.authorId !== session.user.id) {
    const liker = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { displayName: true },
    });

    const notification = await prisma.notification.create({
      data: {
        userId: comment.authorId,
        actorId: session.user.id,
        type: "LIKE",
        predictionId: comment.predictionId,
        message: `${liker?.displayName ?? "Someone"} liked your comment.`,
      },
    });

    emitNotificationCreated({
      notificationId: notification.id,
      userId: comment.authorId,
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
  const comment = await resolveComment(id);
  if (!comment) {
    return apiError("Comment not found.", 404, "NOT_FOUND");
  }

  try {
    await prisma.commentLike.delete({
      where: {
        userId_commentId: {
          userId: session.user.id,
          commentId: comment.id,
        },
      },
    });
  } catch (error) {
    const notFound =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025";

    if (!notFound) {
      console.error("Comment unlike failed:", error);
      return apiError(
        "Something went wrong. Please try again.",
        500,
        "INTERNAL_ERROR",
      );
    }
  }

  const likeCount = await prisma.commentLike.count({
    where: { commentId: comment.id },
  });

  return apiSuccess({ liked: false, likeCount }, "Unliked.");
}
