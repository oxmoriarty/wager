import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createCommentSchema } from "@/lib/validation/comment";
import { getCommentsPage } from "@/lib/queries/comments";
import { emitCommentAdded, emitNotificationCreated } from "@/lib/socket/emit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;

  try {
    const page = await getCommentsPage(id, cursor);
    return apiSuccess(page);
  } catch (error) {
    console.error("Failed to load comments:", error);
    return apiError("Couldn't load comments. Please try again.", 500);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return apiError("You must be signed in.", 401, "UNAUTHENTICATED");
  }

  const { id } = await params;
  const prediction = await prisma.prediction.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });
  if (!prediction) {
    return apiError("Prediction not found.", 404, "NOT_FOUND");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON.", 400);
  }

  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Invalid comment.",
      422,
      "VALIDATION_ERROR",
    );
  }

  let targetParentId: string | null = null;

  // Validate parentId belongs to this prediction (prevent cross-post replies)
  if (parsed.data.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parsed.data.parentId },
      select: { id: true, predictionId: true, parentId: true, authorId: true },
    });
    if (!parent || parent.predictionId !== prediction.id) {
      return apiError("Parent comment not found.", 404, "NOT_FOUND");
    }
    // Flatten to 1 level thread: if the target is already a reply, attach to its root
    targetParentId = parent.parentId ?? parent.id;
  }

  try {
    const commentRaw = await prisma.comment.create({
      data: {
        authorId: session.user.id,
        predictionId: prediction.id,
        content: parsed.data.content,
        ...(targetParentId ? { parentId: targetParentId } : {}),
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        parentId: true,
        author: {
          select: {
            profile: {
              select: { username: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    const comment = {
      id: commentRaw.id,
      content: commentRaw.content,
      createdAt: commentRaw.createdAt,
      parentId: commentRaw.parentId,
      author: {
        username: commentRaw.author.profile?.username ?? "",
        displayName: commentRaw.author.profile?.displayName ?? "",
        avatarUrl: commentRaw.author.profile?.avatarUrl ?? null,
      },
      replies: [],
    };

    emitCommentAdded({
      predictionId: prediction.id,
      commentId: comment.id,
      authorId: session.user.id,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
    });

    // Notify appropriate user
    if (parsed.data.parentId) {
      // Replying to a comment: notify the comment author
      const parentComment = await prisma.comment.findUnique({
        where: { id: parsed.data.parentId },
        select: { authorId: true },
      });
      if (parentComment && parentComment.authorId !== session.user.id) {
        const notification = await prisma.notification.create({
          data: {
            userId: parentComment.authorId,
            actorId: session.user.id,
            type: "COMMENT",
            predictionId: prediction.id,
            message: `${comment.author.displayName} replied to your comment.`,
          },
        });

        emitNotificationCreated({
          notificationId: notification.id,
          userId: parentComment.authorId,
          type: notification.type,
          message: notification.message,
          createdAt: notification.createdAt.toISOString(),
        });
      }
    } else if (prediction.authorId !== session.user.id) {
      // Top-level comment: notify the prediction author
      const notification = await prisma.notification.create({
        data: {
          userId: prediction.authorId,
          actorId: session.user.id,
          type: "COMMENT",
          predictionId: prediction.id,
          message: `${comment.author.displayName} commented on your prediction.`,
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

    return apiSuccess(comment, "Comment posted.", 201);
  } catch (error) {
    console.error("Failed to create comment:", error);
    return apiError(
      "Something went wrong posting your comment. Please try again.",
      500,
      "INTERNAL_ERROR",
    );
  }
}

