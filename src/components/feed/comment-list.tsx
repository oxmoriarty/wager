"use client";

import { useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatRelativeTime } from "@/lib/format";
import { getSocketClient } from "@/lib/socket/client";
import { rooms } from "@/lib/socket/events";
import type { CommentRow, CommentReply } from "@/lib/queries/comments";
import type { ApiError, ApiSuccess } from "@/lib/api-response";

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

// ─── Inline reply composer ────────────────────────────────────────────────────

function ReplyComposer({
  predictionId,
  parentId,
  initialContent = "",
  onSuccess,
  onCancel,
}: {
  predictionId: string;
  parentId: string;
  initialContent?: string;
  onSuccess: (reply: CommentReply) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState(initialContent);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/predictions/${predictionId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), parentId }),
      });
      const body = (await res.json()) as ApiSuccess<CommentReply> | ApiError;
      if (body.success) {
        onSuccess(body.data);
        setContent("");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-2">
      <Textarea
        placeholder="Write a reply…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={500}
        disabled={isSubmitting}
        className="text-sm"
        rows={2}
      />
      <div className="flex gap-2 self-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isSubmitting || !content.trim()}>
          {isSubmitting ? "Posting…" : "Reply"}
        </Button>
      </div>
    </form>
  );
}

// ─── Single comment with optional replies ─────────────────────────────────────

function CommentItem({
  comment,
  predictionId,
  isAuthenticated,
}: {
  comment: CommentRow;
  predictionId: string;
  isAuthenticated: boolean;
}) {
  const [replies, setReplies] = useState<CommentReply[]>(comment.replies);
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [replyToHandle, setReplyToHandle] = useState<string | null>(null);

  function handleReplySuccess(reply: CommentReply) {
    setReplies((prev) => [...prev, reply]);
    setShowReplyComposer(false);
    setReplyToHandle(null);
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Top-level comment */}
      <Card className="gap-2">
        <div className="flex items-start gap-3">
          <Avatar className="size-8 shrink-0">
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
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => {
                  setReplyToHandle(null);
                  setShowReplyComposer((v) => !v);
                }}
                className="text-muted-foreground hover:text-foreground mt-1 w-fit text-xs transition-colors"
              >
                Reply
              </button>
            )}
            {showReplyComposer && (
              <ReplyComposer
                key={replyToHandle ?? "root"}
                predictionId={predictionId}
                parentId={comment.id}
                initialContent={replyToHandle ? `@${replyToHandle} ` : ""}
                onSuccess={handleReplySuccess}
                onCancel={() => {
                  setShowReplyComposer(false);
                  setReplyToHandle(null);
                }}
              />
            )}
          </div>
        </div>
      </Card>

      {/* Replies — indented with left border line (Twitter thread style) */}
      {replies.length > 0 && (
        <div className="border-muted ml-8 flex flex-col gap-0 border-l-2 pl-3">
          {replies.map((reply) => (
            <div key={reply.id} className="py-2">
              <div className="flex items-start gap-2">
                <Avatar className="size-6 shrink-0">
                  <AvatarImage
                    src={reply.author.avatarUrl ?? undefined}
                    alt={reply.author.displayName}
                  />
                  <AvatarFallback className="text-xs">
                    {initials(reply.author.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-x-2 text-xs">
                    <span className="text-foreground font-medium">
                      {reply.author.displayName}
                    </span>
                    <span className="text-muted-foreground">
                      @{reply.author.username} ·{" "}
                      {formatRelativeTime(reply.createdAt)}
                    </span>
                  </div>
                  <p className="text-foreground text-sm whitespace-pre-wrap">
                    {reply.content}
                  </p>
                  {isAuthenticated && (
                    <button
                      type="button"
                      onClick={() => {
                        setReplyToHandle(reply.author.username);
                        setShowReplyComposer(true);
                      }}
                      className="text-muted-foreground hover:text-foreground mt-0.5 w-fit text-[11px] transition-colors"
                    >
                      Reply
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Comment list ─────────────────────────────────────────────────────────────

export function CommentList({
  predictionId,
  initialPage,
  isAuthenticated,
}: {
  predictionId: string;
  initialPage: CommentsPage;
  isAuthenticated: boolean;
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
          <CommentItem
            key={comment.id}
            comment={comment}
            predictionId={predictionId}
            isAuthenticated={isAuthenticated}
          />
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


