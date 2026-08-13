"use client";

import { useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format";
import { getSocketClient } from "@/lib/socket/client";
import { rooms } from "@/lib/socket/events";
import type { CommentRow } from "@/lib/queries/comments";
import type { ApiSuccess } from "@/lib/api-response";

interface CommentsPage {
  items: CommentRow[];
  nextCursor: string | null;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function CommentList({
  predictionId,
  initialPage,
}: {
  predictionId: string;
  initialPage: CommentsPage;
}) {
  const [comments, setComments] = useState(initialPage.items);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasNewComments, setHasNewComments] = useState(false);

  useEffect(() => {
    const socket = getSocketClient();
    const room = rooms.post(predictionId);
    socket.emit("join", room);

    const handleCommentAdded = () => setHasNewComments(true);
    socket.on("comment_added", handleCommentAdded);

    return () => {
      socket.emit("leave", room);
      socket.off("comment_added", handleCommentAdded);
    };
  }, [predictionId]);

  async function loadFreshComments() {
    try {
      const response = await fetch(`/api/predictions/${predictionId}/comments`);
      const body = (await response.json()) as ApiSuccess<CommentsPage>;
      if (body.success) {
        setComments(body.data.items);
        setNextCursor(body.data.nextCursor);
      }
    } finally {
      setHasNewComments(false);
    }
  }

  async function loadMore() {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    try {
      const response = await fetch(
        `/api/predictions/${predictionId}/comments?cursor=${nextCursor}`,
      );
      const body = (await response.json()) as ApiSuccess<CommentsPage>;
      if (body.success) {
        setComments((current) => [...current, ...body.data.items]);
        setNextCursor(body.data.nextCursor);
      }
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {hasNewComments && (
        <button
          onClick={loadFreshComments}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
        >
          New comments — tap to refresh
        </button>
      )}

      {comments.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          No comments yet. Be the first to reply.
        </p>
      ) : (
        comments.map((comment) => (
          <Card key={comment.id} className="gap-2">
            <div className="flex items-start gap-3">
              <Avatar className="size-8">
                <AvatarImage
                  src={comment.author.avatarUrl ?? undefined}
                  alt={comment.author.displayName}
                />
                <AvatarFallback className="text-xs">
                  {initials(comment.author.displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-x-2 text-sm">
                  <span className="text-foreground font-medium">
                    {comment.author.displayName}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    @{comment.author.username} ·{" "}
                    {formatRelativeTime(comment.createdAt)}
                  </span>
                </div>
                <p className="text-foreground text-sm whitespace-pre-wrap">
                  {comment.content}
                </p>
              </div>
            </div>
          </Card>
        ))
      )}

      {nextCursor && (
        <Button
          variant="outline"
          onClick={loadMore}
          disabled={isLoadingMore}
          className="self-center"
        >
          {isLoadingMore ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
