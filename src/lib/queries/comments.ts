import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const COMMENTS_PAGE_SIZE = 20;

const commentSelect = {
  id: true,
  content: true,
  createdAt: true,
  author: {
    select: { username: true, displayName: true, avatarUrl: true },
  },
} satisfies Prisma.CommentSelect;

export type CommentRow = Prisma.CommentGetPayload<{
  select: typeof commentSelect;
}>;

export async function getCommentsPage(predictionId: string, cursor?: string) {
  const comments = await prisma.comment.findMany({
    where: { predictionId },
    take: COMMENTS_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: commentSelect,
  });

  const hasMore = comments.length > COMMENTS_PAGE_SIZE;
  const items = hasMore ? comments.slice(0, COMMENTS_PAGE_SIZE) : comments;

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
}
