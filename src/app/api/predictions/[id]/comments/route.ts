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

  try {
    const commentRaw = await prisma.comment.create({
      data: {
        authorId: session.user.id,
        predictionId: prediction.id,
        content: parsed.data.content,
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: {
          select: {
            profile: {
              select: { username: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    // Flatten profile fields up to author level — mirrors the pattern in
    // `src/lib/queries/comments.ts` so the shape is consistent.
    const comment = {
      id: commentRaw.id,
      content: commentRaw.content,
      createdAt: commentRaw.createdAt,
      author: {
        username: commentRaw.author.profile?.username ?? "",
        displayName: commentRaw.author.profile?.displayName ?? "",
        avatarUrl: commentRaw.author.profile?.avatarUrl ?? null,
      },
    };

    emitCommentAdded({
      predictionId: prediction.id,
      commentId: comment.id,
      authorId: session.user.id,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
    });

    if (prediction.authorId !== session.user.id) {
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
