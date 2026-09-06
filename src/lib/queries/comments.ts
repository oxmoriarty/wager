import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const COMMENTS_PAGE_SIZE = 20;

const authorSelect = {
  profile: {
    select: { username: true, displayName: true, avatarUrl: true },
  },
} satisfies Prisma.UserSelect;

const replySelect = {
  id: true,
  content: true,
  createdAt: true,
  parentId: true,
  author: { select: authorSelect },
} satisfies Prisma.CommentSelect;

const commentSelect = {
  id: true,
  content: true,
  createdAt: true,
  parentId: true,
  author: { select: authorSelect },
  replies: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    select: replySelect,
  },
} satisfies Prisma.CommentSelect;

type RawAuthor = {
  profile: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
};

function flattenAuthor(raw?: RawAuthor | null) {
  return {
    username: raw?.profile?.username ?? "",
    displayName: raw?.profile?.displayName ?? "Anonymous",
    avatarUrl: raw?.profile?.avatarUrl ?? null,
  };
}

export type CommentReply = {
  id: string;
  content: string;
  createdAt: Date | string;
  parentId: string | null;
  author: { username: string; displayName: string; avatarUrl: string | null };
};

export type CommentRow = {
  id: string;
  content: string;
  createdAt: Date | string;
  parentId: string | null;
  author: { username: string; displayName: string; avatarUrl: string | null };
  replies: CommentReply[];
};

export async function getCommentsPage(predictionId: string, cursor?: string) {
  // Only top-level comments (parentId null); replies come nested inside each.
  const comments = await prisma.comment.findMany({
    where: { predictionId, parentId: null },
    take: COMMENTS_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: commentSelect,
  });

  const hasMore = comments.length > COMMENTS_PAGE_SIZE;
  const items: CommentRow[] = (
    hasMore ? comments.slice(0, COMMENTS_PAGE_SIZE) : comments
  ).map((c) => ({
    id: c.id,
    content: c.content,
    createdAt: c.createdAt,
    parentId: c.parentId,
    author: flattenAuthor(c.author),
    replies: c.replies.map((r) => ({
      id: r.id,
      content: r.content,
      createdAt: r.createdAt,
      parentId: r.parentId,
      author: flattenAuthor(r.author),
    })),
  }));

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1]!.id : null,
  };
}

