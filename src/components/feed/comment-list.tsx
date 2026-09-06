"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  Heart,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CommentNode, CommentSortMode } from "@/lib/queries/comments";
import type { ReplyTarget } from "@/components/feed/comment-composer";

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── Comment Like Button ──────────────────────────────────────────────────────

function CommentLikeButton({
  commentId,
  initialLiked,
  initialCount,
  isAuthenticated,
}: {
  commentId: string;
  initialLiked: boolean;
  initialCount: number;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    setLiked(initialLiked);
    setCount(initialCount);
  }, [initialLiked, initialCount]);

  async function handleToggleLike() {
    if (!isAuthenticated) {
      router.push("/sign-in");
      return;
    }
    if (isPending) return;

    const nextLiked = !liked;
    const nextCount = nextLiked ? count + 1 : Math.max(0, count - 1);
    setLiked(nextLiked);
    setCount(nextCount);
    setIsPending(true);

    try {
      const res = await fetch(`/api/comments/${commentId}/like`, {
        method: nextLiked ? "POST" : "DELETE",
      });
      const body = await res.json();
      if (body.success) {
        setLiked(body.data.liked);
        setCount(body.data.likeCount);
      } else {
        setLiked(liked);
        setCount(count);
      }
    } catch {
      setLiked(liked);
      setCount(count);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggleLike}
      className={cn(
        "group flex items-center gap-1.5 text-xs transition-colors focus:outline-none",
        liked
          ? "text-rose-500 font-medium"
          : "text-muted-foreground hover:text-rose-500",
      )}
      title={liked ? "Unlike" : "Like"}
    >
      <Heart
        className={cn(
          "size-3.5 transition-transform group-hover:scale-110",
          liked && "fill-current",
        )}
      />
      <span>{count > 0 ? count : ""}</span>
    </button>
  );
}

// ─── Recursive Tree Item ──────────────────────────────────────────────────────

function CommentTreeItem({
  comment,
  predictionId,
  depth = 0,
  isLast = false,
  isAuthenticated,
  onSelectReply,
}: {
  comment: CommentNode;
  predictionId: string;
  depth?: number;
  isLast?: boolean;
  isAuthenticated: boolean;
  onSelectReply?: (target: ReplyTarget) => void;
}) {
  const router = useRouter();
  const hasReplies = comment.replies && comment.replies.length > 0;
  // Automatically expand if <= 2 replies; collapse if > 2 replies by default
  const [isExpanded, setIsExpanded] = useState(
    hasReplies && comment.replies.length <= 2,
  );

  function handleReplyClick() {
    if (!isAuthenticated) {
      router.push("/sign-in");
      return;
    }
    onSelectReply?.({
      id: comment.id,
      username: comment.author.username,
      displayName: comment.author.displayName,
    });
  }

  // Cap visual indentation depth at level 2 so content remains readable on mobile
  const indentClass =
    depth === 0
      ? ""
      : depth === 1
        ? "ml-4 sm:ml-6"
        : "ml-2 sm:ml-4";

  return (
    <div className={cn("relative flex flex-col", indentClass)}>
      {/* Tree branch connector for nested replies */}
      {depth > 0 && (
        <>
          {/* Vertical line from top to horizontal branch */}
          <div
            className={cn(
              "absolute -left-3.5 sm:-left-5 top-0 w-0.5 bg-border/80",
              isLast ? "h-4 rounded-bl-sm" : "bottom-0",
            )}
          />
          {/* Horizontal branch reaching into the comment */}
          <div className="absolute -left-3.5 sm:-left-5 top-4 h-0.5 w-3 sm:w-4 bg-border/80" />
        </>
      )}

      {/* Main Comment Row */}
      <div className="flex gap-2.5 sm:gap-3 py-2">
        <Link
          href={comment.author.username ? `/${comment.author.username}` : "#"}
          className="shrink-0"
        >
          <Avatar className="size-8 sm:size-9 shrink-0 bg-background ring-2 ring-background">
            <AvatarImage
              src={comment.author.avatarUrl ?? undefined}
              alt={comment.author.displayName}
            />
            <AvatarFallback className="text-xs font-medium">
              {initials(comment.author.displayName)}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <div className="flex flex-wrap items-baseline gap-x-1.5 min-w-0">
            <Link
              href={
                comment.author.username ? `/${comment.author.username}` : "#"
              }
              className="text-foreground font-semibold text-sm hover:underline truncate max-w-[160px] sm:max-w-xs"
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

          {/* Content */}
          <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap mt-0.5 break-words">
            {comment.content}
          </p>

          {/* Actions: Like & Reply */}
          <div className="flex items-center gap-5 mt-1.5 text-muted-foreground">
            <CommentLikeButton
              commentId={comment.id}
              initialLiked={comment.isLiked}
              initialCount={comment.likeCount}
              isAuthenticated={isAuthenticated}
            />

            <button
              type="button"
              onClick={handleReplyClick}
              className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors focus:outline-none"
              title={`Reply to @${comment.author.username}`}
            >
              <CornerDownRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              <span>Reply</span>
            </button>
          </div>
        </div>
      </div>

      {/* Nested Replies Tree */}
      {hasReplies && (
        <div className="relative border-l-2 border-border/70 pl-2 sm:pl-3 ml-3.5 sm:ml-4 flex flex-col">
          {isExpanded ? (
            <>
              {comment.replies.map((child, idx) => (
                <CommentTreeItem
                  key={child.id}
                  comment={child}
                  predictionId={predictionId}
                  depth={depth + 1}
                  isLast={idx === comment.replies.length - 1}
                  isAuthenticated={isAuthenticated}
                  onSelectReply={onSelectReply}
                />
              ))}

              {comment.replies.length > 2 && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="mt-1 flex items-center gap-1.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors self-start"
                >
                  <ChevronUp className="size-3.5" />
                  <span>Collapse replies</span>
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="mt-1 flex items-center gap-2 py-1.5 text-xs font-medium text-primary hover:underline transition-colors self-start"
            >
              <div className="flex items-center gap-1">
                <CornerDownRight className="size-3.5" />
                <span>
                  {comment.replies.length}{" "}
                  {comment.replies.length === 1 ? "reply" : "more replies"}
                </span>
              </div>
              <ChevronDown className="size-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Full Threaded Comment List ───────────────────────────────────────────────

export function CommentList({
  predictionId,
  comments,
  totalCount,
  isAuthenticated,
  sortMode = "conversational",
  onSortChange,
  onSelectReply,
}: {
  predictionId: string;
  comments: CommentNode[];
  totalCount?: number;
  isAuthenticated: boolean;
  sortMode?: CommentSortMode;
  onSortChange?: (mode: CommentSortMode) => void;
  onSelectReply?: (target: ReplyTarget) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* Tree Content */}
      {comments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-card/30 p-8 text-center">
          <p className="text-muted-foreground text-sm">
            No comments yet. Be the first to start the discussion!
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/70 bg-card p-3 sm:p-5 shadow-sm divide-y divide-border/50">
          {comments.map((comment, idx) => (
            <div key={comment.id} className="py-2.5 first:pt-0 last:pb-0">
              <CommentTreeItem
                comment={comment}
                predictionId={predictionId}
                depth={0}
                isLast={idx === comments.length - 1}
                isAuthenticated={isAuthenticated}
                onSelectReply={onSelectReply}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
