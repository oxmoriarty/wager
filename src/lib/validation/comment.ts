import { z } from "zod";

export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Write something first")
    .max(500, "Comments must be at most 500 characters"),
  parentId: z.string().cuid().optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
