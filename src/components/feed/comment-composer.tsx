"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createCommentSchema } from "@/lib/validation/comment";
import type { ApiError, ApiSuccess } from "@/lib/api-response";

const CONTENT_MAX_LENGTH = 500;

export function CommentComposer({
  predictionId,
  isAuthenticated,
}: {
  predictionId: string;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isAuthenticated) {
    return (
      <Button variant="outline" onClick={() => router.push("/sign-in")}>
        Sign in to comment
      </Button>
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
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={handleSubmit} noValidate>
      <Textarea
        placeholder="Add a comment…"
        value={content}
        maxLength={CONTENT_MAX_LENGTH}
        onChange={(e) => setContent(e.target.value)}
        disabled={isSubmitting}
      />
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">
          {content.length}/{CONTENT_MAX_LENGTH}
        </span>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Posting…" : "Comment"}
        </Button>
      </div>
    </form>
  );
}
