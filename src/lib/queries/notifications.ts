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
    select: { username: true, displayName: true, avatarUrl: true },
  },
} satisfies Prisma.NotificationSelect;

export type NotificationRow = Prisma.NotificationGetPayload<{
  select: typeof notificationSelect;
}>;

export async function getNotificationsPage(userId: string, cursor?: string) {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    take: NOTIFICATIONS_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: notificationSelect,
  });

  const hasMore = notifications.length > NOTIFICATIONS_PAGE_SIZE;
  const items = hasMore
    ? notifications.slice(0, NOTIFICATIONS_PAGE_SIZE)
    : notifications;

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
}

export async function getUnreadNotificationCount(userId: string) {
  return prisma.notification.count({ where: { userId, read: false } });
}
