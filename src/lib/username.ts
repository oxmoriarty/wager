import { prisma } from "@/lib/prisma";

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;

/** Lowercases, strips diacritics, and keeps only [a-z0-9_]. */
function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Generates a unique username from a display name or email, appending a
 * numeric suffix on collision. Used to seed a placeholder username at
 * sign-up time — the user customizes it during profile onboarding.
 */
export async function generateUniqueUsername(seed: string): Promise<string> {
  let base = slugify(seed).slice(0, USERNAME_MAX_LENGTH);

  if (base.length < USERNAME_MIN_LENGTH) {
    base = `player_${base}`.slice(0, USERNAME_MAX_LENGTH);
  }
  if (base.length < USERNAME_MIN_LENGTH) {
    base = "player";
  }

  let candidate = base;
  let attempt = 0;

  while (await prisma.profile.findUnique({ where: { username: candidate } })) {
    attempt += 1;
    const suffix = `${attempt}`;
    candidate = `${base.slice(0, USERNAME_MAX_LENGTH - suffix.length)}${suffix}`;
  }

  return candidate;
}

const usernamePattern = /^[a-z0-9_]+$/;

export function isValidUsernameFormat(username: string): boolean {
  return (
    username.length >= USERNAME_MIN_LENGTH &&
    username.length <= USERNAME_MAX_LENGTH &&
    usernamePattern.test(username)
  );
}

/** Checks whether a username is free, optionally ignoring one user's own profile. */
export async function isUsernameAvailable(
  username: string,
  excludeUserId?: string,
): Promise<boolean> {
  const existing = await prisma.profile.findUnique({
    where: { username },
    select: { userId: true },
  });

  if (!existing) return true;
  return existing.userId === excludeUserId;
}
