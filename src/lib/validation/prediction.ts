import { z } from "zod";

export const createPredictionSchema = z.object({
  marketId: z.string().min(1, "Choose a market"),
  side: z.enum(["SUPPORT", "CHALLENGE"]).optional().nullable(),
  content: z
    .string()
    .trim()
    .min(1, "Say something about your prediction")
    .max(500, "Predictions must be at most 500 characters"),
});

export type CreatePredictionInput = z.infer<typeof createPredictionSchema>;
