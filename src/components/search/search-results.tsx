import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MARKET_TYPE_LABEL } from "@/lib/market-labels";
import {
  searchUsers,
  searchMatches,
  searchMarkets,
} from "@/lib/queries/search";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatKickoff(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export async function SearchResults({ query }: { query: string }) {
  const [users, matches, markets] = await Promise.all([
    searchUsers(query),
    searchMatches(query),
    searchMarkets(query),
  ]);

  const hasAnyResults =
    users.length > 0 || matches.length > 0 || markets.length > 0;

  if (!hasAnyResults) {
    return (
      <Card className="text-muted-foreground py-10 text-center text-sm">
        No results for &ldquo;{query}&rdquo;.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {users.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-muted-foreground text-sm font-medium">People</h2>
          <div className="flex flex-col gap-2">
            {users.map((user) => (
              <Link key={user.username} href={`/${user.username}`}>
                <Card className="flex-row items-center gap-3">
                  <Avatar>
                    <AvatarImage
                      src={user.avatarUrl ?? undefined}
                      alt={user.displayName}
                    />
                    <AvatarFallback>
                      {initials(user.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-foreground text-sm font-medium">
                      {user.displayName}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      @{user.username}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {matches.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-muted-foreground text-sm font-medium">Matches</h2>
          <div className="flex flex-col gap-2">
            {matches.map((match) => (
              <Card key={match.id} className="gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-foreground text-sm font-medium">
                    {match.homeTeam} vs {match.awayTeam}
                  </span>
                  <Badge variant="outline">{match.status}</Badge>
                </div>
                <span className="text-muted-foreground text-xs">
                  {match.competition} · {formatKickoff(match.kickoff)}
                </span>
              </Card>
            ))}
          </div>
        </section>
      )}

      {markets.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-muted-foreground text-sm font-medium">Markets</h2>
          <div className="flex flex-col gap-2">
            {markets.map((market) => (
              <Card key={market.id} className="gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-foreground text-sm font-medium">
                    {market.match.homeTeam} vs {market.match.awayTeam}
                  </span>
                  <Badge
                    variant={market.status === "OPEN" ? "success" : "outline"}
                  >
                    {market.status}
                  </Badge>
                </div>
                <span className="text-muted-foreground text-xs">
                  {MARKET_TYPE_LABEL[market.type] ?? market.type}
                  {market.status === "OPEN" &&
                    " · Head to the feed to post a prediction"}
                </span>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
