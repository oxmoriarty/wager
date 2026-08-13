"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Repeat2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { ApiError, ApiSuccess } from "@/lib/api-response";

export function RepostButton({
  predictionId,
  isAuthenticated,
  initialReposted,
  initialCount,
}: {
  predictionId: string;
  isAuthenticated: boolean;
  initialReposted: boolean;
  initialCount: number;
}) {
  const router = useRouter();
  const [isReposted, setIsReposted] = useState(initialReposted);
  const [count, setCount] = useState(initialCount);
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    if (!isAuthenticated) {
      router.push("/sign-in");
      return;
    }

    const nextIsReposted = !isReposted;
    setIsReposted(nextIsReposted);
    setCount((current) => current + (nextIsReposted ? 1 : -1));
    setIsPending(true);

    try {
      const response = await fetch(`/api/predictions/${predictionId}/repost`, {
        method: nextIsReposted ? "POST" : "DELETE",
      });
      const body = (await response.json()) as
        ApiSuccess<{ reposted: boolean; repostCount: number }> | ApiError;

      if (!body.success) {
        setIsReposted(!nextIsReposted);
        setCount((current) => current - (nextIsReposted ? 1 : -1));
        toast.error(body.message);
        return;
      }

      setCount(body.data.repostCount);
    } catch {
      setIsReposted(!nextIsReposted);
      setCount((current) => current - (nextIsReposted ? 1 : -1));
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
      aria-pressed={isReposted}
      className={cn(
        "flex items-center gap-1.5 transition-colors disabled:opacity-50",
        isReposted
          ? "text-success"
          : "text-muted-foreground hover:text-success",
      )}
    >
      <Repeat2 className="size-4" />
      {count.toLocaleString()}
    </button>
  );
}
