import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { createOtpToken } from "@/lib/auth-token";
import { sendPasswordResetEmail } from "@/lib/email/mailer";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON.", 400);
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Enter a valid email address.",
      422,
      "VALIDATION_ERROR",
    );
  }

  const { email } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (user) {
    const code = await createOtpToken(normalizedEmail, "PASSWORD_RESET");
    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "";
    const resetUrl = origin
      ? `${origin}/reset-password?email=${encodeURIComponent(normalizedEmail)}&code=${code}`
      : undefined;

    await sendPasswordResetEmail(normalizedEmail, code, resetUrl);
  }

  // Always return identical success message to prevent account enumeration
  return apiSuccess(
    { email: normalizedEmail },
    "If an account with that email exists, we have sent password reset instructions.",
    200,
  );
}
