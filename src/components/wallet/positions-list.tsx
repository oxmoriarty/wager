import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatUsdcAmount } from "@/lib/format";
import { MARKET_TYPE_LABEL } from "@/lib/market-labels";
import type { PositionRow } from "@/lib/queries/wallet";

const POSITION_STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  WON: "Won",
  LOST: "Lost",
  VOID: "Voided",
  CLAIMED: "Claimed",
};

const POSITION_STATUS_VARIANT: Record<
  string,
  "success" | "warning" | "destructive" | "secondary" | "outline"
> = {
  OPEN: "outline",
  WON: "success",
  LOST: "destructive",
  VOID: "secondary",
  CLAIMED: "secondary",
};

export function PositionsList({ positions }: { positions: PositionRow[] }) {
  if (positions.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        You haven&apos;t staked on any markets yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {positions.map((position) => (
        <Link key={position.id} href={`/matches/${position.market.match.id}`}>
          <Card className="flex-row items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="text-foreground truncate text-sm font-medium">
                {position.market.match.homeTeam} vs{" "}
                {position.market.match.awayTeam}
              </p>
              <p className="text-muted-foreground text-xs">
                {MARKET_TYPE_LABEL[position.market.type] ??
                  position.market.type}{" "}
                · {position.side === "SUPPORT" ? "Support" : "Challenge"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-foreground text-sm font-semibold tabular-nums">
                {formatUsdcAmount(position.amount)} USDC
              </span>
              <Badge
                variant={POSITION_STATUS_VARIANT[position.status] ?? "outline"}
              >
                {POSITION_STATUS_LABEL[position.status] ?? position.status}
              </Badge>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
