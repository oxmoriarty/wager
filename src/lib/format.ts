export function formatRelativeTime(
  date: Date | string | number | null | undefined,
) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(d);
}

/** Absolute kickoff date/time — `formatRelativeTime` is designed for past
 * timestamps (likes, comments) and reads oddly for a future fixture time. */
export function formatKickoff(date: Date | string | number | null | undefined) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

/** Formats a Market's pool amount for display. USDC pool fields come out of
 * Prisma as `Decimal` and must be converted to string/number before ever
 * crossing a Server -> Client Component boundary (Decimal isn't
 * serializable) — callers should pass the already-`.toString()`-ed value
 * from the query layer, per `src/lib/queries/match.ts`. */
export function formatUsdcAmount(amount: string | number) {
  const value = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
