import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { verifyOtpToken } from "@/lib/auth-token";

const PASSWORD_SALT_ROUNDS = 12;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON.", 400);
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Invalid password reset details.",
      422,
      "VALIDATION_ERROR",
    );
  }

  const { email, code, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return apiError("No account found with that email.", 404, "USER_NOT_FOUND");
  }

  const verification = await verifyOtpToken(
    normalizedEmail,
    "PASSWORD_RESET",
    code,
  );

  if (!verification.valid) {
    if (verification.reason === "EXPIRED_CODE") {
      return apiError(
        "That reset code has expired. Please request a new one.",
        400,
        "EXPIRED_CODE",
      );
    }
    return apiError(
      "Incorrect reset code. Please check your email and try again.",
      400,
      "INVALID_CODE",
    );
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      // If the user reset their password via email, their email is confirmed valid
      emailVerified: user.emailVerified ?? new Date(),
    },
  });

  return apiSuccess(
    null,
    "Your password has been successfully reset. You can now sign in.",
    200,
  );
}
