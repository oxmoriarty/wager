import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LikeButton } from "@/components/feed/like-button";
import { RepostButton } from "@/components/feed/repost-button";
import { formatRelativeTime } from "@/lib/format";
import { MARKET_TYPE_LABEL } from "@/lib/market-labels";
import type { FeedItem } from "@/lib/queries/feed";

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function PredictionCard({
  prediction,
  isAuthenticated,
}: {
  prediction: FeedItem;
  isAuthenticated: boolean;
}) {
  const { author, market } = prediction;

  return (
    <Card className="gap-3">
      <div className="flex items-start gap-3">
        <Link href={`/${author.username}`}>
          <Avatar>
            <AvatarImage
              src={author.avatarUrl ?? undefined}
              alt={author.displayName}
            />
            <AvatarFallback>{initials(author.displayName)}</AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            <Link
              href={`/${author.username}`}
              className="text-foreground font-medium hover:underline"
            >
              {author.displayName}
            </Link>
            <span className="text-muted-foreground">@{author.username}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {formatRelativeTime(prediction.createdAt)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {prediction.side && (
              <Badge
                variant={prediction.side === "SUPPORT" ? "success" : "warning"}
              >
                {prediction.side === "SUPPORT" ? "Supporting" : "Challenging"}
              </Badge>
            )}
            <Link
              href={`/matches/${market.match.id}`}
              className="text-muted-foreground hover:text-foreground hover:underline"
            >
              {market.match.homeTeam} vs {market.match.awayTeam} ·{" "}
              {MARKET_TYPE_LABEL[market.type] ?? market.type}
            </Link>
          </div>

          <p className="text-foreground text-sm whitespace-pre-wrap">
            {prediction.content}
          </p>

          {(() => {
            const supportNum = Number((market as any).totalSupportAmount ?? 0);
            const challengeNum = Number((market as any).totalChallengeAmount ?? 0);
            const totalPool = supportNum + challengeNum;
            if (totalPool <= 0) return null;

            const supportPct = Math.round((supportNum / totalPool) * 100);
            const challengePct = 100 - supportPct;

            return (
              <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs">
                <div className="flex items-center justify-between font-medium">
                  <span className="text-emerald-500">
                    YES / Support {supportPct}%
                  </span>
                  <span className="text-amber-500">
                    NO / Challenge {challengePct}%
                  </span>
                </div>
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-amber-500/20">
                  <div
                    className="bg-emerald-500 transition-all duration-300"
                    style={{ width: `${supportPct}%` }}
                  />
                  <div
                    className="bg-amber-500 transition-all duration-300"
                    style={{ width: `${challengePct}%` }}
                  />
                </div>
              </div>
            );
          })()}

          <div className="text-muted-foreground flex items-center gap-5 pt-1 text-xs">
            <LikeButton
              predictionId={prediction.id}
              isAuthenticated={isAuthenticated}
              initialLiked={prediction.isLikedByViewer}
              initialCount={prediction._count.likes}
            />
            <Link
              href={`/${author.username}/${prediction.id}`}
              className="hover:text-foreground flex items-center gap-1.5 transition-colors"
            >
              <MessageCircle className="size-4" />
              {prediction._count.comments.toLocaleString()}
            </Link>
            <RepostButton
              predictionId={prediction.id}
              isAuthenticated={isAuthenticated}
              initialReposted={prediction.isRepostedByViewer}
              initialCount={prediction._count.reposts}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
