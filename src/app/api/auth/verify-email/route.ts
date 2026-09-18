import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { verifyEmailSchema } from "@/lib/validation/auth";
import { verifyOtpToken } from "@/lib/auth-token";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON.", 400);
  }

  const parsed = verifyEmailSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Invalid verification details.",
      422,
      "VALIDATION_ERROR",
    );
  }

  const { email, code } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return apiError("No account found with that email.", 404, "USER_NOT_FOUND");
  }

  if (user.emailVerified) {
    return apiSuccess(
      { email: normalizedEmail, alreadyVerified: true },
      "Your email is already verified. You can sign in.",
      200,
    );
  }

  const verification = await verifyOtpToken(
    normalizedEmail,
    "EMAIL_VERIFICATION",
    code,
  );

  if (!verification.valid) {
    if (verification.reason === "EXPIRED_CODE") {
      return apiError(
        "That verification code has expired. Please request a new code.",
        400,
        "EXPIRED_CODE",
      );
    }
    return apiError(
      "Incorrect verification code. Please check your email and try again.",
      400,
      "INVALID_CODE",
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date() },
  });

  return apiSuccess(
    { email: normalizedEmail, verified: true },
    "Email verified successfully! You can now sign in.",
    200,
  );
}
