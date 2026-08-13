import { apiError, apiSuccess } from "@/lib/api-response";
import { searchQuerySchema } from "@/lib/validation/search";
import {
  searchUsers,
  searchMatches,
  searchMarkets,
} from "@/lib/queries/search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = searchQuerySchema.safeParse(searchParams.get("q") ?? "");

  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Invalid search query.",
      422,
      "VALIDATION_ERROR",
    );
  }

  try {
    const [users, matches, markets] = await Promise.all([
      searchUsers(parsed.data),
      searchMatches(parsed.data),
      searchMarkets(parsed.data),
    ]);

    return apiSuccess({ users, matches, markets });
  } catch (error) {
    console.error("Search failed:", error);
    return apiError("Search failed. Please try again.", 500);
  }
}
