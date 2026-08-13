import { apiError, apiSuccess } from "@/lib/api-response";
import { syncMatchStatusesFromGenLayer } from "@/lib/genlayer/sync-match-status";

/**
 * Triggers a Match Monitoring sync across every non-terminal Match in
 * the database. See src/app/api/admin/sync-fixtures/route.ts's comment
 * — same access-control caveat applies here (intended for a scheduled
 * job, not a user-facing endpoint).
 */
export async function POST() {
  try {
    const result = await syncMatchStatusesFromGenLayer();
    return apiSuccess(result, "Match statuses synced.");
  } catch (error) {
    console.error("Match status sync failed:", error);
    return apiError(
      "Match status sync failed. Please try again.",
      502,
      "GENLAYER_ERROR",
    );
  }
}
