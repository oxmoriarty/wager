"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";
import type { NotificationRow } from "@/lib/queries/notifications";
import type { ApiError, ApiSuccess } from "@/lib/api-response";

interface NotificationsPage {
  items: NotificationRow[];
  nextCursor: string | null;
  unreadCount: number;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function notificationHref(notification: NotificationRow) {
  if (notification.predictionId) {
    return `/${notification.actor?.username}/${notification.predictionId}`;
  }
  if (notification.actor) {
    return `/${notification.actor.username}`;
  }
  return "/notifications";
}

// Inline "Follow Back" button for FOLLOW notifications
function FollowBackButton({
  username,
  initialIsFollowingBack,
}: {
  username: string;
  initialIsFollowingBack: boolean;
}) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowingBack);
  const [isPending, setIsPending] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault(); // don't navigate
    e.stopPropagation();
    if (isFollowing) return;
    setIsPending(true);
    try {
      const res = await fetch(`/api/users/${username}/follow`, {
        method: "POST",
      });
      const body = (await res.json()) as ApiSuccess<{ following: boolean }> | ApiError;
      if (body.success) {
        setIsFollowing(true);
      } else {
        toast.error(body.message);
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button
      size="sm"
      variant={isFollowing ? "outline" : "default"}
      onClick={handleClick}
      disabled={isPending || isFollowing}
      className="shrink-0 text-xs h-7 px-2.5"
    >
      {isPending ? "…" : isFollowing ? "Following" : "Follow Back"}
    </Button>
  );
}

export function NotificationsList({
  initialPage,
}: {
  initialPage: NotificationsPage;
}) {
  const [notifications, setNotifications] = useState(initialPage.items);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markAsRead(id: string) {
    setNotifications((current) =>
      current.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    } catch {
      // Non-critical
    }
  }

  async function markAllAsRead() {
    setIsMarkingAll(true);
    setNotifications((current) => current.map((n) => ({ ...n, read: true })));
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
    } finally {
      setIsMarkingAll(false);
    }
  }

  async function loadMore() {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    try {
      const response = await fetch(`/api/notifications?cursor=${nextCursor}`);
      const body = (await response.json()) as ApiSuccess<NotificationsPage>;
      if (body.success) {
        setNotifications((current) => [...current, ...body.data.items]);
        setNextCursor(body.data.nextCursor);
      }
    } finally {
      setIsLoadingMore(false);
    }
  }

  if (notifications.length === 0) {
    return (
      <Card className="text-muted-foreground py-10 text-center text-sm">
        No notifications yet.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {unreadCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="self-end"
          onClick={markAllAsRead}
          disabled={isMarkingAll}
        >
          {isMarkingAll ? "Marking…" : "Mark all as read"}
        </Button>
      )}

      {notifications.map((notification) => (
        <Link
          key={notification.id}
          href={notificationHref(notification)}
          onClick={() => {
            if (!notification.read) markAsRead(notification.id);
          }}
        >
          <Card
            className={cn(
              "flex-row items-center gap-3 transition-colors",
              !notification.read && "border-primary/40 bg-primary/5",
            )}
          >
            <Avatar className="size-9 shrink-0">
              <AvatarImage
                src={notification.actor?.avatarUrl ?? undefined}
                alt={notification.actor?.displayName ?? ""}
              />
              <AvatarFallback className="text-xs">
                {notification.actor
                  ? initials(notification.actor.displayName)
                  : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-foreground text-sm">{notification.message}</p>
              <span className="text-muted-foreground text-xs">
                {formatRelativeTime(notification.createdAt)}
              </span>
            </div>

            {/* Follow-back CTA for FOLLOW notifications */}
            {notification.type === "FOLLOW" && notification.actor?.username && (
              <FollowBackButton
                username={notification.actor.username}
                initialIsFollowingBack={notification.isFollowingBack}
              />
            )}

            {!notification.read && (
              <span className="bg-primary size-2 shrink-0 rounded-full" />
            )}
          </Card>
        </Link>
      ))}

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

