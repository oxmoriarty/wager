import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return apiError("You must be signed in.", 401, "UNAUTHENTICATED");
  }

  const { id } = await params;

  // Scoped to the current user in the WHERE clause rather than fetch-then-
  // check, so this is a single query and naturally can't leak whether a
  // notification belonging to someone else exists.
  const result = await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { read: true },
  });

  if (result.count === 0) {
    return apiError("Notification not found.", 404, "NOT_FOUND");
  }

  return apiSuccess({ read: true }, "Marked as read.");
}
