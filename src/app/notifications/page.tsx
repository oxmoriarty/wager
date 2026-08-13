import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  getNotificationsPage,
  getUnreadNotificationCount,
} from "@/lib/queries/notifications";
import { AppHeader } from "@/components/layout/app-header";
import { NotificationsList } from "@/components/notifications/notifications-list";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const [page, unreadCount] = await Promise.all([
    getNotificationsPage(session.user.id),
    getUnreadNotificationCount(session.user.id),
  ]);

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8 sm:px-6">
        <h1 className="text-foreground text-lg font-semibold">Notifications</h1>
        <NotificationsList initialPage={{ ...page, unreadCount }} />
      </main>
    </>
  );
}
