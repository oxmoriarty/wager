/**
 * Lightweight admin-auth guard for internal automation endpoints
 * (`/api/admin/*`). Compares a `Bearer` token against the
 * `ADMIN_API_KEY` env var. In production, your scheduler
 * (cron-job.org, Vercel Cron, etc.) sends this key in its requests;
 * anyone without it gets a 401.
 *
 * Usage in a route:
 *   if (!isAdminAuthorized(request)) {
 *     return apiError("Unauthorized.", 401, "UNAUTHORIZED");
 *   }
 */
export function isAdminAuthorized(request: Request): boolean {
  const apiKey = process.env.ADMIN_API_KEY;
  if (!apiKey) {
    console.warn(
      "ADMIN_API_KEY is not set — all admin requests will be rejected. " +
        "Set it in .env to enable admin endpoints.",
    );
    return false;
  }

  const header = request.headers.get("Authorization");
  if (!header) return false;

  const [scheme, token] = header.split(" ", 2);
  if (scheme !== "Bearer" || !token) return false;

  return token === apiKey;
}
