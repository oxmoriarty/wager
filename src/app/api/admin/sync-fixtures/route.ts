import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { syncFixturesFromGenLayer } from "@/lib/genlayer/sync-fixtures";

const syncRequestSchema = z.object({
  competition: z.string().trim().min(1, "competition is required"),
  sourceUrl: z.url("sourceUrl must be a valid URL"),
});

/**
 * Triggers fixture discovery on the GenLayer Fixture Discovery
 * Intelligent Contract and syncs the result into Wager's database.
 *
 * Not yet gated behind an admin role check — Wager doesn't have role-
 * based authorization built yet. This route is intended to be called by
 * a scheduled job (with a shared secret or IP allowlist at the
 * infrastructure level) rather than end users. Do not expose a link to
 * this route in any user-facing UI.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON.", 400);
  }

  const parsed = syncRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Invalid request.",
      422,
      "VALIDATION_ERROR",
    );
  }

  try {
    const result = await syncFixturesFromGenLayer(
      parsed.data.competition,
      parsed.data.sourceUrl,
    );
    return apiSuccess(result, "Fixture discovery synced.");
  } catch (error) {
    console.error("Fixture discovery sync failed:", error);
    return apiError(
      "Fixture discovery sync failed. Please try again.",
      502,
      "GENLAYER_ERROR",
    );
  }
}
