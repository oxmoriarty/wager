import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { resendCodeSchema } from "@/lib/validation/auth";
import { createOtpToken } from "@/lib/auth-token";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "@/lib/email/mailer";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON.", 400);
  }

  const parsed = resendCodeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Invalid request.",
      422,
      "VALIDATION_ERROR",
    );
  }

  const { email, type } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  // Always return success on resend to avoid leaking existing accounts
  if (!user) {
    return apiSuccess(null, "If an account exists, a code has been sent.", 200);
  }

  if (type === "EMAIL_VERIFICATION" && user.emailVerified) {
    return apiError(
      "This email is already verified. You can sign in.",
      400,
      "ALREADY_VERIFIED",
    );
  }

  const code = await createOtpToken(normalizedEmail, type);

  if (type === "EMAIL_VERIFICATION") {
    await sendVerificationEmail(normalizedEmail, code);
  } else {
    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "";
    const resetUrl = origin
      ? `${origin}/reset-password?email=${encodeURIComponent(normalizedEmail)}&code=${code}`
      : undefined;
    await sendPasswordResetEmail(normalizedEmail, code, resetUrl);
  }

  return apiSuccess(null, "A new code has been sent to your email.", 200);
}
