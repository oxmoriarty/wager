import { apiSuccess, apiError } from "@/lib/api-response";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { syncSettlementsFromGenLayer } from "@/lib/genlayer/sync-settlement";

/**
 * Triggers the settlement pipeline (PROJECT.md §6).
 * Admin route meant to be called on a schedule to synchronize matches
 * that have reached a terminal state with the GenLayer settlement contract.
 */
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return apiError("Unauthorized.", 401, "UNAUTHORIZED");
  }

  try {
    const result = await syncSettlementsFromGenLayer();
    return apiSuccess(result, "Settlement sync completed");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Settlement sync failed:", message);
    return apiError(`Settlement sync failed: ${message}`, 500);
  }
}
