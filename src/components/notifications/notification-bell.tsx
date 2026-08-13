"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { getSocketClient } from "@/lib/socket/client";

export function NotificationBell({
  initialUnreadCount,
}: {
  initialUnreadCount: number;
}) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  useEffect(() => {
    const socket = getSocketClient();
    const handleNotificationCreated = () =>
      setUnreadCount((current) => current + 1);

    socket.on("notification_created", handleNotificationCreated);
    return () => {
      socket.off("notification_created", handleNotificationCreated);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      className="text-muted-foreground hover:text-foreground relative flex size-8 items-center justify-center transition-colors"
      aria-label={
        unreadCount > 0
          ? `Notifications, ${unreadCount} unread`
          : "Notifications"
      }
    >
      <Bell className="size-5" />
      {unreadCount > 0 && (
        <span className="bg-error absolute top-0 right-0 flex size-4 items-center justify-center rounded-full text-[10px] font-medium text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
