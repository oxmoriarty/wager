import { auth } from "@/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import {
  getNotificationsPage,
  getUnreadNotificationCount,
} from "@/lib/queries/notifications";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return apiError("You must be signed in.", 401, "UNAUTHENTICATED");
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;

  try {
    const [page, unreadCount] = await Promise.all([
      getNotificationsPage(session.user.id, cursor),
      getUnreadNotificationCount(session.user.id),
    ]);

    return apiSuccess({ ...page, unreadCount });
  } catch (error) {
    console.error("Failed to load notifications:", error);
    return apiError("Couldn't load notifications. Please try again.", 500);
  }
}
