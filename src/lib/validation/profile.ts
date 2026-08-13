import { z } from "zod";

// Kept in sync with src/lib/username.ts's slug rules.
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(
    /^[a-z0-9_]+$/,
    "Username can only contain lowercase letters, numbers, and underscores",
  );

export const onboardingSchema = z.object({
  username: usernameSchema,
  displayName: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters")
    .max(50, "Display name must be at most 50 characters"),
  bio: z
    .string()
    .trim()
    .max(280, "Bio must be at most 280 characters")
    .optional()
    .or(z.literal("")),
  avatarUrl: z.url().optional().or(z.literal("")),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
