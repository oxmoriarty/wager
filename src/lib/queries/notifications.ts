import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const NOTIFICATIONS_PAGE_SIZE = 20;

const notificationSelect = {
  id: true,
  type: true,
  message: true,
  read: true,
  predictionId: true,
  createdAt: true,
  actor: {
    select: {
      profile: {
        select: { username: true, displayName: true, avatarUrl: true },
      },
    },
  },
} satisfies Prisma.NotificationSelect;

type RawNotificationRow = Prisma.NotificationGetPayload<{
  select: typeof notificationSelect;
}>;

export type NotificationRow = Omit<RawNotificationRow, "actor"> & {
  actor: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
};

export async function getNotificationsPage(userId: string, cursor?: string) {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    take: NOTIFICATIONS_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: notificationSelect,
  });

  const hasMore = notifications.length > NOTIFICATIONS_PAGE_SIZE;
  const rawItems = hasMore
    ? notifications.slice(0, NOTIFICATIONS_PAGE_SIZE)
    : notifications;

  const items = rawItems.map((n) => ({
    ...n,
    actor: n.actor
      ? {
          username: n.actor.profile?.username ?? "",
          displayName: n.actor.profile?.displayName ?? "",
          avatarUrl: n.actor.profile?.avatarUrl ?? null,
        }
      : null,
  }));

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
}

export async function getUnreadNotificationCount(userId: string) {
  return prisma.notification.count({ where: { userId, read: false } });
}
