import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { onboardingSchema } from "@/lib/validation/profile";
import { isUsernameAvailable } from "@/lib/username";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return apiError("You must be signed in.", 401, "UNAUTHENTICATED");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON.", 400);
  }

  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Invalid profile details.",
      422,
      "VALIDATION_ERROR",
    );
  }

  const { username, displayName, bio, avatarUrl } = parsed.data;

  const available = await isUsernameAvailable(username, session.user.id);
  if (!available) {
    return apiError("That username is already taken.", 409, "USERNAME_TAKEN");
  }

  try {
    const profile = await prisma.profile.update({
      where: { userId: session.user.id },
      data: {
        username,
        displayName,
        bio: bio || null,
        avatarUrl: avatarUrl || null,
        onboardedAt: new Date(),
      },
      select: {
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
      },
    });

    return apiSuccess(profile, "Profile updated.");
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return apiError(
        "That username was just taken. Please try another.",
        409,
        "USERNAME_TAKEN",
      );
    }

    console.error("Onboarding update failed:", error);
    return apiError(
      "Something went wrong saving your profile. Please try again.",
      500,
      "INTERNAL_ERROR",
    );
  }
}
