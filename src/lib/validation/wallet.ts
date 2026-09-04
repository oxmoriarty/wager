import { z } from "zod";

/** Matches `PredictionSide` (Prisma) / `Side` (arc/src/Types.sol). */
export const stakeSideSchema = z.enum(["SUPPORT", "CHALLENGE"]);

/** Positive decimal string, up to 6 decimal places — matches
 * `Market.totalSupportAmount`'s `@db.Decimal(18, 6)` precision and
 * Circle's contract-execution `amount` field convention (human-readable
 * USDC units, e.g. `"10.50"`, not wei). */
const usdcAmountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/, "Enter a valid USDC amount")
  .refine((value) => Number(value) > 0, "Amount must be greater than zero");

export const stakeChallengeSchema = z.object({
  marketId: z.string().min(1),
  side: stakeSideSchema,
  amount: usdcAmountSchema,
});

export const stakeConfirmSchema = z.object({
  marketId: z.string().min(1),
  side: stakeSideSchema,
  amount: usdcAmountSchema,
});

export const claimChallengeSchema = z.object({
  marketId: z.string().min(1),
});

export const claimConfirmSchema = z.object({
  marketId: z.string().min(1),
});
