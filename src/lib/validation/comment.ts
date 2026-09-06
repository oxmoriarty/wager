import { z } from "zod";

export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Write something first")
    .max(500, "Comments must be at most 500 characters"),
  parentId: z.string().optional().nullable(),
  parentReplyId: z.string().optional().nullable(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
