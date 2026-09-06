"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createCommentSchema } from "@/lib/validation/comment";
import type { ApiError, ApiSuccess } from "@/lib/api-response";

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

export function CommentComposer({
  predictionId,
  isAuthenticated,
  currentUser,
}: {
  predictionId: string;
  isAuthenticated: boolean;
  currentUser?: {
    name?: string | null;
    image?: string | null;
  } | null;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    const parsed = createCommentSchema.safeParse({ content });
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
      const body = (await response.json()) as ApiSuccess<unknown> | ApiError;

      if (!body.success) {
        toast.error(body.message);
        return;
      }

      setContent("");
      router.refresh();
      window.dispatchEvent(new CustomEvent("wager:comment_added"));
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
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
            placeholder="Post your comment…"
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
              {isSubmitting ? "Posting…" : "Comment"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
