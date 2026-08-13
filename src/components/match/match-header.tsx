"use client";

import { useEffect, useState } from "react";
import { Circle } from "lucide-react";
import type { MatchStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatKickoff } from "@/lib/format";
import {
  MATCH_STATUS_BADGE_VARIANT,
  MATCH_STATUS_LABEL,
} from "@/lib/match-labels";
import { getSocketClient } from "@/lib/socket/client";
import { rooms } from "@/lib/socket/events";
import type { ScoreUpdatedPayload } from "@/lib/socket/events";

interface MatchHeaderProps {
  matchId: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: Date;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
}

/**
 * Joins `rooms.match(matchId)` and reflects `score_updated` events live.
 * This is the first client subscriber to that room — the emitter
 * (`emitScoreUpdated` in `src/lib/socket/emit.ts`) has existed since the
 * Match Monitoring sync job shipped but had no listener until now.
 *
 * The Match Monitoring Intelligent Contract's status vocabulary is defined
 * to exactly match Prisma's `MatchStatus` enum (see PROJECT_STATE.md), so
 * casting the payload's `status: string` to `MatchStatus` here is safe.
 */
export function MatchHeader({
  matchId,
  competition,
  homeTeam,
  awayTeam,
  kickoff,
  status: initialStatus,
  homeScore: initialHomeScore,
  awayScore: initialAwayScore,
}: MatchHeaderProps) {
  const [status, setStatus] = useState(initialStatus);
  const [homeScore, setHomeScore] = useState(initialHomeScore);
  const [awayScore, setAwayScore] = useState(initialAwayScore);

  useEffect(() => {
    const socket = getSocketClient();
    const room = rooms.match(matchId);
    socket.emit("join", room);

    function handleScoreUpdated(payload: ScoreUpdatedPayload) {
      setHomeScore(payload.homeScore);
      setAwayScore(payload.awayScore);
      setStatus(payload.status as MatchStatus);
    }

    socket.on("score_updated", handleScoreUpdated);

    return () => {
      socket.emit("leave", room);
      socket.off("score_updated", handleScoreUpdated);
    };
  }, [matchId]);

  const hasScore = homeScore !== null && awayScore !== null;

  return (
    <Card className="items-center gap-3 text-center">
      <div className="flex w-full items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {competition}
        </span>
        <Badge variant={MATCH_STATUS_BADGE_VARIANT[status]}>
          {status === "LIVE" && (
            <Circle className="size-2 fill-current" aria-hidden="true" />
          )}
          {MATCH_STATUS_LABEL[status]}
        </Badge>
      </div>

      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3">
        <span className="text-foreground truncate text-right text-base font-semibold sm:text-lg">
          {homeTeam}
        </span>
        <span className="text-foreground text-2xl font-bold tabular-nums">
          {hasScore ? `${homeScore} – ${awayScore}` : "vs"}
        </span>
        <span className="text-foreground truncate text-left text-base font-semibold sm:text-lg">
          {awayTeam}
        </span>
      </div>

      <p className="text-muted-foreground text-xs">{formatKickoff(kickoff)}</p>
    </Card>
  );
}
