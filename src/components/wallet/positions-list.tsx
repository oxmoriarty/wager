"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatUsdcAmount } from "@/lib/format";
import { MARKET_TYPE_LABEL } from "@/lib/market-labels";
import { executeCircleChallenge } from "@/lib/circle/web-sdk";
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

const CIRCLE_APP_ID = process.env.NEXT_PUBLIC_CIRCLE_APP_ID;

function isClaimable(status: string): boolean {
  return status === "WON" || status === "VOID";
}

function ClaimButton({
  position,
  onClaimed,
}: {
  position: PositionRow;
  onClaimed: (marketId: string) => void;
}) {
  const [isClaiming, setIsClaiming] = useState(false);

  async function handleClaim(e: React.MouseEvent) {
    e.preventDefault(); // Prevent the Link navigation
    e.stopPropagation();

    if (!CIRCLE_APP_ID) {
      toast.error("Circle App ID is not configured.");
      return;
    }

    setIsClaiming(true);
    try {
      // Step 1: Start the claim challenge
      const challengeRes = await fetch("/api/wallet/claim-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: position.market.id }),
      });
      const challengeData = await challengeRes.json();

      if (!challengeRes.ok || challengeData.status === "error") {
        toast.error(challengeData.message ?? "Failed to start claim.");
        return;
      }

      const { challengeId, userToken, encryptionKey } = challengeData.data;

      // Step 2: Execute via Circle Web SDK
      await executeCircleChallenge({
        appId: CIRCLE_APP_ID,
        userToken,
        encryptionKey,
        challengeId,
      });

      // Step 3: Confirm on the server
      const confirmRes = await fetch("/api/wallet/claim-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: position.market.id }),
      });
      const confirmData = await confirmRes.json();

      if (!confirmRes.ok || confirmData.status === "error") {
        toast.error(confirmData.message ?? "Claim confirmation failed.");
        return;
      }

      toast.success(
        position.status === "VOID"
          ? "Refund claimed successfully!"
          : `Payout of ${confirmData.data.payout} USDC claimed!`,
      );
      onClaimed(position.market.id);
    } catch (error) {
      console.error("Claim failed:", error);
      toast.error("Something went wrong with your claim. Please try again.");
    } finally {
      setIsClaiming(false);
    }
  }

  return (
    <Button
      size="sm"
      variant={position.status === "VOID" ? "outline" : "default"}
      disabled={isClaiming}
      onClick={handleClaim}
    >
      {isClaiming
        ? "Claiming…"
        : position.status === "VOID"
          ? "Claim Refund"
          : "Claim Payout"}
    </Button>
  );
}

export function PositionsList({
  positions: initialPositions,
}: {
  positions: PositionRow[];
}) {
  const [positions, setPositions] = useState(initialPositions);

  function handleClaimed(marketId: string) {
    setPositions((prev) =>
      prev.map((p) =>
        p.market.id === marketId ? { ...p, status: "CLAIMED" } : p,
      ),
    );
  }

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
              {isClaimable(position.status) ? (
                <ClaimButton
                  position={position}
                  onClaimed={handleClaimed}
                />
              ) : (
                <Badge
                  variant={
                    POSITION_STATUS_VARIANT[position.status] ?? "outline"
                  }
                >
                  {POSITION_STATUS_LABEL[position.status] ?? position.status}
                </Badge>
              )}
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
