import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { signUpSchema } from "@/lib/validation/auth";
import { generateUniqueUsername } from "@/lib/username";

const PASSWORD_SALT_ROUNDS = 12;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON.", 400);
  }

  const parsed = signUpSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Invalid sign-up details.",
      422,
      "VALIDATION_ERROR",
    );
  }

  const { email, password, displayName } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    return apiError(
      "An account with that email already exists.",
      409,
      "EMAIL_TAKEN",
    );
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
  const username = await generateUniqueUsername(displayName);

  try {
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        profile: {
          create: {
            username,
            displayName,
          },
        },
      },
      select: {
        id: true,
        email: true,
        profile: { select: { username: true, displayName: true } },
      },
    });

    return apiSuccess(user, "Account created.", 201);
  } catch (error) {
    // Unique constraint race (email or generated username taken between
    // the check above and the insert) — ask the client to retry rather
    // than leaking the raw database error.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return apiError(
        "That email or username was just taken. Please try again.",
        409,
        "CONFLICT",
      );
    }

    console.error("Sign-up failed:", error);
    return apiError(
      "Something went wrong creating your account. Please try again.",
      500,
      "INTERNAL_ERROR",
    );
  }
}
