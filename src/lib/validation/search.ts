import { z } from "zod";

export const searchQuerySchema = z
  .string()
  .trim()
  .min(1, "Type something to search")
  .max(100, "Search query is too long");
