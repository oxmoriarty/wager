"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CornerDownRight, X } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createCommentSchema } from "@/lib/validation/comment";
import type { ApiError, ApiSuccess } from "@/lib/api-response";
import type { CommentNode } from "@/lib/queries/comments";

const CONTENT_MAX_LENGTH = 500;

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export interface ReplyTarget {
  id: string;
  username: string;
  displayName: string;
}

export function CommentComposer({
  predictionId,
  isAuthenticated,
  currentUser,
  replyTarget,
  onCancelReply,
  onCommentSubmitted,
}: {
  predictionId: string;
  isAuthenticated: boolean;
  currentUser?: {
    name?: string | null;
    image?: string | null;
  } | null;
  replyTarget?: ReplyTarget | null;
  onCancelReply?: () => void;
  onCommentSubmitted?: (comment: CommentNode) => void;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (replyTarget && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyTarget]);

  if (!isAuthenticated) {
    return (
      <div className="rounded-xl border border-border/70 bg-card/60 p-4 text-center backdrop-blur-sm">
        <p className="text-muted-foreground text-sm mb-3">
          Sign in to join the conversation and comment on this prediction.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/sign-in")}
          className="rounded-full px-6 text-xs font-medium"
        >
          Sign in
        </Button>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      content,
      parentId: replyTarget?.id ?? null,
      parentReplyId: replyTarget?.id ?? null,
    };

    const parsed = createCommentSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid comment.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/predictions/${predictionId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );
      const body = (await response.json()) as ApiSuccess<CommentNode> | ApiError;

      if (!body.success) {
        toast.error(body.message);
        return;
      }

      setContent("");
      onCancelReply?.();
      onCommentSubmitted?.(body.data);
      router.refresh();
      window.dispatchEvent(new CustomEvent("wager:comment_added"));
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      id="comment-composer"
      className="rounded-xl border border-border/80 bg-card p-4 shadow-sm transition-all"
    >
      {replyTarget && (
        <div className="mb-2.5 flex items-center justify-between rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <CornerDownRight className="size-3.5 text-primary" />
            Replying to <span className="text-primary">@{replyTarget.username}</span>
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Cancel reply and return to post"
          >
            <X className="size-3" />
            <span>Cancel</span>
          </button>
        </div>
      )}

      <div className="flex items-start gap-3">
        <Avatar className="size-9 shrink-0">
          <AvatarImage
            src={currentUser?.image ?? undefined}
            alt={currentUser?.name ?? "You"}
          />
          <AvatarFallback className="text-xs font-medium">
            {initials(currentUser?.name ?? "You")}
          </AvatarFallback>
        </Avatar>

        <form
          className="flex min-w-0 flex-1 flex-col gap-2"
          onSubmit={handleSubmit}
          noValidate
        >
          <Textarea
            ref={textareaRef}
            placeholder={
              replyTarget
                ? `Reply to @${replyTarget.username}…`
                : "Post your reply…"
            }
            value={content}
            maxLength={CONTENT_MAX_LENGTH}
            onChange={(e) => setContent(e.target.value)}
            disabled={isSubmitting}
            className="min-h-[72px] resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60"
          />
          <div className="flex items-center justify-between border-t border-border/40 pt-2">
            <span className="text-muted-foreground text-xs">
              {content.length}/{CONTENT_MAX_LENGTH}
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !content.trim()}
              className="rounded-full px-5 text-xs font-semibold"
            >
              {isSubmitting ? "Posting…" : "Reply"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
