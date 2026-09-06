import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const authorSelect = {
  profile: {
    select: { username: true, displayName: true, avatarUrl: true },
  },
} satisfies Prisma.UserSelect;

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

export type CommentNode = {
  id: string;
  content: string;
  createdAt: Date | string;
  parentId: string | null;
  author: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  likeCount: number;
  isLiked: boolean;
  replies: CommentNode[];
};

// Aliases for compatibility
export type CommentRow = CommentNode;
export type CommentReply = CommentNode;

export type CommentSortMode = "conversational" | "latest" | "likes";

export async function getCommentsPage(
  predictionId: string,
  viewerId?: string,
  sort: CommentSortMode = "conversational",
) {
  // Query all comments for this prediction to build full recursive hierarchy
  const rawComments = await prisma.comment.findMany({
    where: { predictionId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      content: true,
      createdAt: true,
      parentId: true,
      author: { select: authorSelect },
      likes: {
        select: { userId: true },
      },
    },
  });

  // Construct recursive tree
  const map = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const c of rawComments) {
    const isLiked = viewerId ? c.likes.some((l) => l.userId === viewerId) : false;
    map.set(c.id, {
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      parentId: c.parentId,
      author: flattenAuthor(c.author),
      likeCount: c.likes.length,
      isLiked,
      replies: [],
    });
  }

  for (const c of rawComments) {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort top-level roots based on mode
  if (sort === "latest") {
    roots.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } else if (sort === "likes") {
    roots.sort((a, b) => b.likeCount - a.likeCount);
  }
  // "conversational" preserves ascending chronological order

  return {
    items: roots,
    totalCount: rawComments.length,
    nextCursor: null,
  };
}

