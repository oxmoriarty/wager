"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

import { getSocketClient } from "@/lib/socket/client";
import { rooms } from "@/lib/socket/events";

/**
 * Every real-time feature that targets a specific user (Follow,
 * Likes, Comments, Reposts — all emit `notification_created` to
 * `rooms.user(userId)`) depends on that user's client actually being a
 * member of that room. Socket.IO room membership is per-connection and
 * must be joined explicitly; it was never wired up until this
 * component existed, meaning every prior `notification_created` emit
 * had zero subscribers regardless of how correctly it was targeted.
 *
 * Mounted once in `Providers` (present on every page) rather than in
 * any specific feature, since notifications should arrive no matter
 * what page the user is currently on.
 */
export function UserRoomSync() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;

  useEffect(() => {
    if (status !== "authenticated" || !userId) return;

    const socket = getSocketClient();
    const room = rooms.user(userId);
    socket.emit("join", room);

    return () => {
      socket.emit("leave", room);
    };
  }, [status, userId]);

  return null;
}
