import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { AuthTokenType } from "@prisma/client";

/**
 * Generates a cryptographically secure 6-digit numeric OTP and saves or updates
 * it in the auth_tokens table. Expires in 15 minutes by default.
 */
export async function createOtpToken(
  identifier: string,
  type: AuthTokenType,
  expiresInMinutes = 15,
): Promise<string> {
  const token = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  const normalizedIdentifier = identifier.toLowerCase();

  await prisma.authToken.upsert({
    where: {
      identifier_type: {
        identifier: normalizedIdentifier,
        type,
      },
    },
    create: {
      identifier: normalizedIdentifier,
      token,
      type,
      expiresAt,
    },
    update: {
      token,
      expiresAt,
    },
  });

  return token;
}

export type VerifyOtpResult =
  | { valid: true }
  | { valid: false; reason: "INVALID_CODE" | "EXPIRED_CODE" };

/**
 * Validates a 6-digit OTP code against the database.
 * If valid, removes the token so it cannot be re-used.
 */
export async function verifyOtpToken(
  identifier: string,
  type: AuthTokenType,
  token: string,
): Promise<VerifyOtpResult> {
  const normalizedIdentifier = identifier.toLowerCase();
  const record = await prisma.authToken.findUnique({
    where: {
      identifier_type: {
        identifier: normalizedIdentifier,
        type,
      },
    },
  });

  if (!record) {
    return { valid: false, reason: "INVALID_CODE" };
  }

  if (new Date() > record.expiresAt) {
    await prisma.authToken
      .delete({ where: { id: record.id } })
      .catch(() => {});
    return { valid: false, reason: "EXPIRED_CODE" };
  }

  if (record.token !== token.trim()) {
    return { valid: false, reason: "INVALID_CODE" };
  }

  // Token is valid — consume and delete it
  await prisma.authToken
    .delete({ where: { id: record.id } })
    .catch(() => {});

  return { valid: true };
}
