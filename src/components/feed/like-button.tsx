"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { ApiError, ApiSuccess } from "@/lib/api-response";

export function LikeButton({
  predictionId,
  isAuthenticated,
  initialLiked,
  initialCount,
}: {
  predictionId: string;
  isAuthenticated: boolean;
  initialLiked: boolean;
  initialCount: number;
}) {
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    if (!isAuthenticated) {
      router.push("/sign-in");
      return;
    }

    const nextIsLiked = !isLiked;
    setIsLiked(nextIsLiked);
    setCount((current) => current + (nextIsLiked ? 1 : -1));
    setIsPending(true);

    try {
      const response = await fetch(`/api/predictions/${predictionId}/like`, {
        method: nextIsLiked ? "POST" : "DELETE",
      });
      const body = (await response.json()) as
        ApiSuccess<{ liked: boolean; likeCount: number }> | ApiError;

      if (!body.success) {
        setIsLiked(!nextIsLiked);
        setCount((current) => current - (nextIsLiked ? 1 : -1));
        toast.error(body.message);
        return;
      }

      // Reconcile with the server's count in case of concurrent likes.
      setCount(body.data.likeCount);
    } catch {
      setIsLiked(!nextIsLiked);
      setCount((current) => current - (nextIsLiked ? 1 : -1));
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={isLiked}
      className={cn(
        "flex items-center gap-1.5 transition-colors disabled:opacity-50",
        isLiked ? "text-error" : "text-muted-foreground hover:text-error",
      )}
    >
      <Heart className={cn("size-4", isLiked && "fill-current")} />
      {count.toLocaleString()}
    </button>
  );
}
