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
  initialIsFollowingBack,
}: {
  username: string;
  isAuthenticated: boolean;
  initialIsFollowing: boolean;
  /** True when the profile owner is also following the viewer */
  initialIsFollowingBack: boolean;
}) {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isPending, setIsPending] = useState(false);
  const [showUnfollowDialog, setShowUnfollowDialog] = useState(false);

  if (!isAuthenticated) {
    return (
      <Button variant="outline" onClick={() => router.push("/sign-in")}>
        Follow
      </Button>
    );
  }

  async function follow() {
    setIsPending(true);
    try {
      const res = await fetch(`/api/users/${username}/follow`, {
        method: "POST",
      });
      const body = (await res.json()) as ApiSuccess<{ following: boolean }> | ApiError;
      if (!body.success) {
        toast.error(body.message);
        return;
      }
      setIsFollowing(true);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  async function unfollow() {
    setShowUnfollowDialog(false);
    setIsPending(true);
    try {
      const res = await fetch(`/api/users/${username}/follow`, {
        method: "DELETE",
      });
      const body = (await res.json()) as ApiSuccess<{ following: boolean }> | ApiError;
      if (!body.success) {
        toast.error(body.message);
        return;
      }
      setIsFollowing(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  // Already following — show "Following" with unfollow dialog on click
  if (isFollowing) {
    return (
      <div className="relative">
        <Button
          variant="outline"
          disabled={isPending}
          onClick={() => setShowUnfollowDialog(true)}
        >
          Following
        </Button>

        {showUnfollowDialog && (
          <>
            <div
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs"
              onClick={() => setShowUnfollowDialog(false)}
            />
            <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 bg-card border-border flex flex-col gap-4 rounded-xl border p-5 shadow-2xl min-w-[240px] text-center">
              <p className="text-foreground text-sm font-medium">
                Unfollow @{username}?
              </p>
              <div className="flex justify-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowUnfollowDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={unfollow}
                  disabled={isPending}
                >
                  {isPending ? "Unfollowing…" : "Unfollow"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Not following — show Follow or Follow Back depending on whether they follow viewer
  const label = initialIsFollowingBack ? "Follow Back" : "Follow";

  return (
    <Button disabled={isPending} onClick={follow}>
      {label}
    </Button>
  );
}


