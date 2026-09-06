"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── Inline reply composer ────────────────────────────────────────────────────

function ReplyComposer({
  predictionId,
  parentId,
  replyToHandle,
  onSuccess,
  onCancel,
}: {
  predictionId: string;
  parentId: string;
  replyToHandle: string | null;
  onSuccess: (reply: CommentReply) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/predictions/${predictionId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed, parentId }),
      });
      const body = (await res.json()) as ApiSuccess<CommentReply> | ApiError;
      if (body.success) {
        onSuccess(body.data);
        setContent("");
      } else {
        toast.error(body.message);
      }
    } catch {
      toast.error("Failed to post reply. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      {replyToHandle && (
        <div className="text-xs text-muted-foreground">
          Replying to <span className="text-primary font-medium">@{replyToHandle}</span>
        </div>
      )}
      <Textarea
        ref={textareaRef}
        placeholder="Post your reply…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={500}
        disabled={isSubmitting}
        className="min-h-[64px] resize-none text-sm bg-muted/30 focus-visible:bg-background"
        rows={2}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {content.length}/500
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
            className="h-7 px-3 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || !content.trim()}
            className="h-7 rounded-full px-4 text-xs font-semibold"
          >
            {isSubmitting ? "Posting…" : "Reply"}
          </Button>
        </div>
      </div>
    </form>
  );
}

// ─── Single comment with optional replies ─────────────────────────────────────

function CommentItem({
  comment,
  predictionId,
  isAuthenticated,
  currentUser,
}: {
  comment: CommentRow;
  predictionId: string;
  isAuthenticated: boolean;
  currentUser?: {
    name?: string | null;
    image?: string | null;
  } | null;
}) {
  const router = useRouter();
  const [replies, setReplies] = useState<CommentReply[]>(comment.replies);
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [replyToHandle, setReplyToHandle] = useState<string | null>(null);
  const [replyTargetId, setReplyTargetId] = useState<string>(comment.id);

  useEffect(() => {
    setReplies(comment.replies);
  }, [comment.replies]);

  function handleReplySuccess(reply: CommentReply) {
    setReplies((prev) => [...prev, reply]);
    setShowReplyComposer(false);
    setReplyToHandle(null);
    setReplyTargetId(comment.id);
    window.dispatchEvent(new CustomEvent("wager:comment_added"));
  }

  function handleOpenReply(handle?: string | null, targetCommentId?: string) {
    if (!isAuthenticated) {
      router.push("/sign-in");
      return;
    }
    setReplyToHandle(handle ?? null);
    setReplyTargetId(targetCommentId ?? comment.id);
    setShowReplyComposer(true);
  }

  const hasReplies = replies.length > 0;
  const isParentConnected = hasReplies || showReplyComposer;

  return (
    <div className="flex flex-col">
      {/* ── Top-level Parent Comment ── */}
      <div className="flex gap-3">
        {/* Left Column: Avatar & Vertical Connector */}
        <div className="relative flex w-9 shrink-0 flex-col items-center">
          <Link
            href={comment.author.username ? `/${comment.author.username}` : "#"}
            className="relative z-10"
          >
            <Avatar className="size-9 shrink-0 bg-background ring-4 ring-background">
              <AvatarImage
                src={comment.author.avatarUrl ?? undefined}
                alt={comment.author.displayName}
              />
              <AvatarFallback className="text-xs font-medium">
                {initials(comment.author.displayName)}
              </AvatarFallback>
            </Avatar>
          </Link>

          {/* Vertical connector extending downwards to replies/composer */}
          {isParentConnected && (
            <div className="absolute top-5 bottom-0 w-0.5 bg-border left-1/2 -translate-x-1/2 z-0" />
          )}
        </div>

        {/* Right Column: Content & Actions */}
        <div className="flex min-w-0 flex-1 flex-col pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-1.5 min-w-0">
              <Link
                href={comment.author.username ? `/${comment.author.username}` : "#"}
                className="text-foreground font-semibold text-sm hover:underline truncate max-w-[180px] sm:max-w-xs"
              >
                {comment.author.displayName}
              </Link>
              {comment.author.username && (
                <span className="text-muted-foreground text-xs truncate">
                  @{comment.author.username}
                </span>
              )}
              <span className="text-muted-foreground text-xs">·</span>
              <span className="text-muted-foreground text-xs shrink-0">
                {formatRelativeTime(comment.createdAt)}
              </span>
            </div>
          </div>

          <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap mt-1 break-words">
            {comment.content}
          </p>

          <div className="flex items-center gap-6 mt-2">
            <button
              type="button"
              onClick={() => handleOpenReply(comment.author.username, comment.id)}
              className="group flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors focus:outline-none"
              title="Reply"
            >
              <div className="p-1.5 rounded-full group-hover:bg-primary/10 transition-colors">
                <MessageCircle className="size-3.5" />
              </div>
              <span>{replies.length > 0 ? replies.length : "Reply"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Replies in Thread ── */}
      {replies.map((reply, index) => {
        const isLastReply = index === replies.length - 1;
        const hasFollowup = !isLastReply || showReplyComposer;

        return (
          <div key={reply.id} className="flex gap-3">
            {/* Left Column: Avatar & Vertical Connector */}
            <div className="relative flex w-9 shrink-0 flex-col items-center">
              {hasFollowup ? (
                // Full vertical line passing behind avatar
                <div className="absolute top-0 bottom-0 w-0.5 bg-border left-1/2 -translate-x-1/2 z-0" />
              ) : (
                // Line enters from top and terminates inside avatar
                <div className="absolute top-0 h-5 w-0.5 bg-border left-1/2 -translate-x-1/2 z-0" />
              )}

              <Link
                href={reply.author.username ? `/${reply.author.username}` : "#"}
                className="relative z-10"
              >
                <Avatar className="size-9 shrink-0 bg-background ring-4 ring-background">
                  <AvatarImage
                    src={reply.author.avatarUrl ?? undefined}
                    alt={reply.author.displayName}
                  />
                  <AvatarFallback className="text-xs font-medium">
                    {initials(reply.author.displayName)}
                  </AvatarFallback>
                </Avatar>
              </Link>
            </div>

            {/* Right Column: Reply Content & Actions */}
            <div className="flex min-w-0 flex-1 flex-col pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-baseline gap-x-1.5 min-w-0">
                  <Link
                    href={reply.author.username ? `/${reply.author.username}` : "#"}
                    className="text-foreground font-semibold text-sm hover:underline truncate max-w-[180px] sm:max-w-xs"
                  >
                    {reply.author.displayName}
                  </Link>
                  {reply.author.username && (
                    <span className="text-muted-foreground text-xs truncate">
                      @{reply.author.username}
                    </span>
                  )}
                  <span className="text-muted-foreground text-xs">·</span>
                  <span className="text-muted-foreground text-xs shrink-0">
                    {formatRelativeTime(reply.createdAt)}
                  </span>
                </div>
              </div>

              <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap mt-1 break-words">
                {reply.content}
              </p>

              <div className="flex items-center gap-6 mt-2">
                <button
                  type="button"
                  onClick={() => handleOpenReply(reply.author.username, reply.id)}
                  className="group flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                  title="Reply"
                >
                  <div className="p-1.5 rounded-full group-hover:bg-primary/10 transition-colors">
                    <MessageCircle className="size-3.5" />
                  </div>
                  <span>Reply</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* ── Inline Reply Composer (connected into thread) ── */}
      {showReplyComposer && (
        <div className="flex gap-3 pt-1">
          <div className="relative flex w-9 shrink-0 flex-col items-center">
            {/* Line entering from above and terminating inside composer avatar */}
            <div className="absolute top-0 h-5 w-0.5 bg-border left-1/2 -translate-x-1/2 z-0" />
            <Avatar className="size-9 shrink-0 relative z-10 bg-background ring-4 ring-background">
              <AvatarImage
                src={currentUser?.image ?? undefined}
                alt={currentUser?.name ?? "You"}
              />
              <AvatarFallback className="text-xs font-medium">
                {initials(currentUser?.name ?? "You")}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="flex min-w-0 flex-1 flex-col pb-2">
            <ReplyComposer
              predictionId={predictionId}
              parentId={replyTargetId}
              replyToHandle={replyToHandle}
              onSuccess={handleReplySuccess}
              onCancel={() => {
                setShowReplyComposer(false);
                setReplyToHandle(null);
                setReplyTargetId(comment.id);
              }}
            />
          </div>
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
  currentUser,
}: {
  predictionId: string;
  initialPage: CommentsPage;
  isAuthenticated: boolean;
  currentUser?: {
    name?: string | null;
    image?: string | null;
  } | null;
}) {
  const [comments, setComments] = useState(initialPage.items);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    setComments(initialPage.items);
    setNextCursor(initialPage.nextCursor);
  }, [initialPage.items, initialPage.nextCursor]);

  async function loadFreshComments() {
    try {
      const response = await fetch(`/api/predictions/${predictionId}/comments`);
      const body = (await response.json()) as ApiSuccess<CommentsPage>;
      if (body.success) {
        setComments(body.data.items);
        setNextCursor(body.data.nextCursor);
      }
    } catch {
      // non-critical
    }
  }

  useEffect(() => {
    const socket = getSocketClient();
    const room = rooms.post(predictionId);
    socket.emit("join", room);

    const handleCommentAdded = () => {
      loadFreshComments();
    };
    socket.on("comment_added", handleCommentAdded);
    window.addEventListener("wager:comment_added", handleCommentAdded);

    return () => {
      socket.emit("leave", room);
      socket.off("comment_added", handleCommentAdded);
      window.removeEventListener("wager:comment_added", handleCommentAdded);
    };
  }, [predictionId]);

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
    <div className="flex flex-col gap-4">
      {comments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-card/30 p-8 text-center">
          <p className="text-muted-foreground text-sm">
            No comments yet. Be the first to reply.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/70 bg-card divide-y divide-border/60 shadow-sm overflow-hidden">
          {comments.map((comment) => (
            <div key={comment.id} className="p-4 sm:p-5">
              <CommentItem
                comment={comment}
                predictionId={predictionId}
                isAuthenticated={isAuthenticated}
                currentUser={currentUser}
              />
            </div>
          ))}
        </div>
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


