import { auth } from "@/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getTransactionsPage } from "@/lib/queries/wallet";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return apiError("You must be signed in.", 401, "UNAUTHENTICATED");
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;

  try {
    const page = await getTransactionsPage(session.user.id, cursor);
    return apiSuccess(page);
  } catch (error) {
    console.error("Failed to load transaction history:", error);
    return apiError(
      "Couldn't load transaction history. Please try again.",
      500,
    );
  }
}
