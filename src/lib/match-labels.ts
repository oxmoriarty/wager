import type { MarketStatus, MatchStatus } from "@prisma/client";
import type { VariantProps } from "class-variance-authority";

import type { badgeVariants } from "@/components/ui/badge";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Mirrors the seven `MatchStatus` values the Match Monitoring Intelligent
 * Contract returns (`genlayer/contracts/match_monitoring.py`) — see
 * PROJECT_STATE.md for why the contract's status vocabulary is an exact
 * match for this enum rather than a looser string. */
export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  SCHEDULED: "Scheduled",
  LIVE: "Live",
  FINISHED: "Full-time",
  POSTPONED: "Postponed",
  SUSPENDED: "Suspended",
  ABANDONED: "Abandoned",
  CANCELED: "Canceled",
};

export const MATCH_STATUS_BADGE_VARIANT: Record<MatchStatus, BadgeVariant> = {
  SCHEDULED: "outline",
  LIVE: "success",
  FINISHED: "secondary",
  POSTPONED: "warning",
  SUSPENDED: "warning",
  ABANDONED: "destructive",
  CANCELED: "destructive",
};

export const MARKET_STATUS_LABEL: Record<MarketStatus, string> = {
  OPEN: "Open",
  LOCKED: "Locked",
  SETTLING: "Settling",
  SETTLED: "Settled",
  VOID: "Void",
};

export const MARKET_STATUS_BADGE_VARIANT: Record<MarketStatus, BadgeVariant> = {
  OPEN: "success",
  LOCKED: "warning",
  SETTLING: "warning",
  SETTLED: "secondary",
  VOID: "destructive",
};
