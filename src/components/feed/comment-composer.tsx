"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CornerDownRight, X } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createCommentSchema } from "@/lib/validation/comment";
import { cn } from "@/lib/utils";
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
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  // When a replyTarget is passed, expand and focus
  useEffect(() => {
    if (replyTarget) {
      setIsExpanded(true);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [replyTarget]);

  // When user clicks to expand, focus the textarea
  useEffect(() => {
    if (isExpanded) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [isExpanded]);

  // Click outside listener: collapse if user hasn't typed anything and isn't replying to a target
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        composerRef.current &&
        !composerRef.current.contains(event.target as Node)
      ) {
        if (!content.trim() && !replyTarget) {
          setIsExpanded(false);
        }
      }
    }

    if (isExpanded) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isExpanded, content, replyTarget]);

  function handleCancel() {
    setContent("");
    setIsExpanded(false);
    onCancelReply?.();
  }

  if (!isAuthenticated) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none pb-3 sm:pb-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none -z-10" />
        <div className="mx-auto w-full max-w-xl px-4 sm:px-6 pointer-events-auto">
          <div
            onClick={() => router.push("/sign-in")}
            className="flex items-center justify-between rounded-2xl border border-border/80 bg-card/95 px-4 py-2.5 backdrop-blur-md shadow-xl cursor-pointer hover:border-primary/50 transition-colors"
          >
            <span className="text-muted-foreground text-xs sm:text-sm">
              Sign in to join the conversation…
            </span>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full h-7 px-4 text-xs font-medium pointer-events-none"
            >
              Sign in
            </Button>
          </div>
        </div>
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
      setIsExpanded(false);
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
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none pb-3 sm:pb-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      {/* Smooth gradient fade behind bottom composer */}
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background via-background/85 to-transparent pointer-events-none -z-10" />

      <div className="mx-auto w-full max-w-xl px-4 sm:px-6 pointer-events-auto">
        <div
          ref={composerRef}
          id="comment-composer"
          className={cn(
            "rounded-2xl border border-border/80 bg-card/95 backdrop-blur-md shadow-2xl transition-all duration-200 ease-out",
            isExpanded
              ? "p-4"
              : "px-3.5 py-2 sm:px-4 sm:py-2.5 cursor-pointer hover:border-border",
          )}
          onClick={() => {
            if (!isExpanded) setIsExpanded(true);
          }}
        >
          {/* ── Compact Initial State (Low Height) ── */}
          {!isExpanded ? (
            <div className="flex items-center gap-3">
              <Avatar className="size-7 sm:size-8 shrink-0">
                <AvatarImage
                  src={currentUser?.image ?? undefined}
                  alt={currentUser?.name ?? "You"}
                />
                <AvatarFallback className="text-[11px] font-medium">
                  {initials(currentUser?.name ?? "You")}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 text-sm text-muted-foreground/70 select-none py-0.5">
                Post your reply…
              </div>

              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="rounded-full h-7 px-3.5 text-xs font-semibold"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(true);
                }}
              >
                Reply
              </Button>
            </div>
          ) : (
            /* ── Expanded State (Full Height on Click / Focus) ── */
            <div className="flex flex-col gap-2">
              {replyTarget && (
                <div className="flex items-center justify-between rounded-lg bg-primary/10 px-2.5 py-1 text-xs text-primary">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <CornerDownRight className="size-3.5 text-primary" />
                    Replying to{" "}
                    <span className="text-primary font-semibold">
                      @{replyTarget.username}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancel();
                    }}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    title="Cancel reply"
                  >
                    <X className="size-3" />
                    <span>Cancel</span>
                  </button>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Avatar className="size-8 sm:size-9 shrink-0 mt-0.5">
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
                    className="min-h-[80px] sm:min-h-[90px] resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60"
                  />

                  <div className="flex items-center justify-between border-t border-border/40 pt-2">
                    <span className="text-muted-foreground text-xs">
                      {content.length}/{CONTENT_MAX_LENGTH}
                    </span>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCancel}
                        disabled={isSubmitting}
                        className="h-8 px-3 text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={isSubmitting || !content.trim()}
                        className="rounded-full h-8 px-5 text-xs font-semibold"
                      >
                        {isSubmitting ? "Posting…" : "Reply"}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
