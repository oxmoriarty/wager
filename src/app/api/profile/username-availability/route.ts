import { auth } from "@/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { usernameSchema } from "@/lib/validation/profile";
import { isUsernameAvailable } from "@/lib/username";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return apiError("You must be signed in.", 401, "UNAUTHENTICATED");
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("username") ?? "";

  const parsed = usernameSchema.safeParse(raw);
  if (!parsed.success) {
    return apiSuccess(
      { available: false, reason: parsed.error.issues[0]?.message },
      "Invalid username format.",
    );
  }

  const available = await isUsernameAvailable(parsed.data, session.user.id);
  return apiSuccess({ available, username: parsed.data });
}
