import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format";
import { MARKET_TYPE_LABEL } from "@/lib/market-labels";
import {
  MARKET_STATUS_BADGE_VARIANT,
  MARKET_STATUS_LABEL,
} from "@/lib/match-labels";
import type { MarketDetail } from "@/lib/queries/match";
import { MarketStakePanel } from "@/components/match/market-stake-panel";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function MarketCard({
  market,
  isSignedIn,
  hasWallet,
}: {
  market: MarketDetail;
  isSignedIn: boolean;
  hasWallet: boolean;
}) {
  const isSettled = market.status === "SETTLED";

  return (
    <Card className="gap-3">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">
          {MARKET_TYPE_LABEL[market.type] ?? market.type}
        </CardTitle>
        <Badge variant={MARKET_STATUS_BADGE_VARIANT[market.status]}>
          {MARKET_STATUS_LABEL[market.status]}
        </Badge>
      </CardHeader>

      <CardContent className="gap-3 p-0">
        {isSettled && market.outcome && (
          <div className="bg-secondary/50 rounded-lg p-3 text-sm">
            <p className="text-foreground font-medium">
              Result: {market.outcome}
            </p>
            {market.settlementSummary && (
              <p className="text-muted-foreground mt-1 text-xs">
                {market.settlementSummary}
              </p>
            )}
            {market.settlementConfidence !== null && (
              <p className="text-muted-foreground mt-1 text-xs">
                Confidence: {Math.round(market.settlementConfidence * 100)}%
              </p>
            )}
          </div>
        )}

        <MarketStakePanel
          marketId={market.id}
          marketStatus={market.status}
          predictionCount={market._count.predictions}
          totalSupportAmount={market.totalSupportAmount}
          totalChallengeAmount={market.totalChallengeAmount}
          viewerPosition={market.viewerPosition}
          isSignedIn={isSignedIn}
          hasWallet={hasWallet}
        />

        {market.predictions.length > 0 && (
          <div className="border-border flex flex-col gap-2 border-t pt-3">
            {market.predictions.map((prediction) => (
              <Link
                key={prediction.id}
                href={`/${prediction.author.username}/${prediction.id}`}
                className="hover:bg-secondary/40 -m-1.5 flex items-start gap-2 rounded-md p-1.5 transition-colors"
              >
                <Avatar className="size-6">
                  <AvatarImage
                    src={prediction.author.avatarUrl ?? undefined}
                    alt={prediction.author.displayName}
                  />
                  <AvatarFallback className="text-[10px]">
                    {initials(prediction.author.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-foreground font-medium">
                      {prediction.author.displayName}
                    </span>
                    <Badge
                      variant={
                        prediction.side === "SUPPORT" ? "success" : "warning"
                      }
                      className="px-1.5 py-0 text-[10px]"
                    >
                      {prediction.side === "SUPPORT"
                        ? "Supporting"
                        : "Challenging"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    {prediction.content}
                  </p>
                </div>
                <span className="text-muted-foreground shrink-0 text-[10px]">
                  {formatRelativeTime(prediction.createdAt)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
