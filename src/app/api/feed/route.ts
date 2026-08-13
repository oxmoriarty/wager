import { auth } from "@/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getFeedPage } from "@/lib/queries/feed";

export async function GET(request: Request) {
  const session = await auth();
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;

  try {
    const page = await getFeedPage(cursor, session?.user?.id);
    return apiSuccess(page);
  } catch (error) {
    console.error("Failed to load feed:", error);
    return apiError("Couldn't load the feed. Please try again.", 500);
  }
}
