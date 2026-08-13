"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ApiError, ApiSuccess } from "@/lib/api-response";

export function FollowButton({
  username,
  isAuthenticated,
  initialIsFollowing,
}: {
  username: string;
  isAuthenticated: boolean;
  initialIsFollowing: boolean;
}) {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isPending, setIsPending] = useState(false);

  if (!isAuthenticated) {
    return (
      <Button variant="outline" onClick={() => router.push("/sign-in")}>
        Follow
      </Button>
    );
  }

  async function handleClick() {
    const nextIsFollowing = !isFollowing;
    setIsFollowing(nextIsFollowing);
    setIsPending(true);

    try {
      const response = await fetch(`/api/users/${username}/follow`, {
        method: nextIsFollowing ? "POST" : "DELETE",
      });
      const body = (await response.json()) as
        ApiSuccess<{ following: boolean }> | ApiError;

      if (!body.success) {
        setIsFollowing(!nextIsFollowing);
        toast.error(body.message);
        return;
      }

      router.refresh();
    } catch {
      setIsFollowing(!nextIsFollowing);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button
      variant={isFollowing ? "outline" : "default"}
      disabled={isPending}
      onClick={handleClick}
    >
      {isFollowing ? "Following" : "Follow"}
    </Button>
  );
}
