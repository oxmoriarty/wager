"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatUsdcAmount } from "@/lib/format";
import { executeCircleChallenge } from "@/lib/circle/web-sdk";
import { useWalletSetup } from "@/lib/circle/use-wallet-setup";
import { getSocketClient } from "@/lib/socket/client";
import { rooms } from "@/lib/socket/events";
import type { LiquidityUpdatedPayload } from "@/lib/socket/events";
import type { ApiError, ApiSuccess } from "@/lib/api-response";
import type { ViewerPosition } from "@/lib/queries/match";

interface MarketStakePanelProps {
  marketId: string;
  marketStatus: string;
  predictionCount: number;
  totalSupportAmount: string;
  totalChallengeAmount: string;
  viewerPosition: ViewerPosition | null;
  isSignedIn: boolean;
  hasWallet: boolean;
}

type StakeChallengeData = {
  challengeId: string;
  userToken: string;
  encryptionKey: string;
};

const CIRCLE_APP_ID = process.env.NEXT_PUBLIC_CIRCLE_APP_ID;

async function parseApiResponse<T>(
  response: Response,
): Promise<ApiSuccess<T> | ApiError> {
  return (await response.json()) as ApiSuccess<T> | ApiError;
}

/**
 * Live pool totals (subscribes to `rooms.market(id)`) plus the full
 * Support/Challenge staking flow. Wallet provisioning itself is handled
 * by the shared `useWalletSetup` hook — this component only owns the
 * stake-specific steps (start challenge -> execute -> confirm).
 */
export function MarketStakePanel({
  marketId,
  marketStatus,
  predictionCount,
  totalSupportAmount,
  totalChallengeAmount,
  viewerPosition,
  isSignedIn,
  hasWallet,
}: MarketStakePanelProps) {
  const router = useRouter();
  const { isSettingUp, setupWallet } = useWalletSetup();
  const [supportTotal, setSupportTotal] = useState(totalSupportAmount);
  const [challengeTotal, setChallengeTotal] = useState(totalChallengeAmount);
  const [amount, setAmount] = useState("");
  const [pendingSide, setPendingSide] = useState<
    "SUPPORT" | "CHALLENGE" | null
  >(null);

  useEffect(() => {
    const socket = getSocketClient();
    const room = rooms.market(marketId);
    socket.emit("join", room);

    function handleLiquidityUpdated(payload: LiquidityUpdatedPayload) {
      setSupportTotal(payload.totalSupportAmount);
      setChallengeTotal(payload.totalChallengeAmount);
    }

    socket.on("liquidity_updated", handleLiquidityUpdated);

    return () => {
      socket.emit("leave", room);
      socket.off("liquidity_updated", handleLiquidityUpdated);
    };
  }, [marketId]);

  async function handleStake(side: "SUPPORT" | "CHALLENGE") {
    if (!/^\d+(\.\d{1,6})?$/.test(amount) || Number(amount) <= 0) {
      toast.error("Enter a valid USDC amount.");
      return;
    }
    if (!CIRCLE_APP_ID) {
      toast.error("Staking isn't configured yet — missing app id.");
      return;
    }

    setPendingSide(side);
    try {
      const challengeResponse = await fetch("/api/wallet/stake-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId, side, amount }),
      });
      const challengeBody =
        await parseApiResponse<StakeChallengeData>(challengeResponse);
      if (!challengeBody.success) {
        toast.error(challengeBody.message);
        return;
      }

      await executeCircleChallenge({
        appId: CIRCLE_APP_ID,
        ...challengeBody.data,
      });

      const confirmResponse = await fetch("/api/wallet/stake-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId, side, amount }),
      });
      const confirmBody = await parseApiResponse<{ amount: string }>(
        confirmResponse,
      );
      if (!confirmBody.success) {
        toast.error(confirmBody.message);
        return;
      }

      toast.success(
        `Staked ${amount} USDC on ${side === "SUPPORT" ? "Support" : "Challenge"}.`,
      );
      setAmount("");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Stake failed. Please try again.",
      );
    } finally {
      setPendingSide(null);
    }
  }

  const isOpen = marketStatus === "OPEN";
  const isPending = pendingSide !== null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-6 text-sm">
        <div>
          <p className="text-success font-semibold">
            {formatUsdcAmount(supportTotal)} USDC
          </p>
          <p className="text-muted-foreground text-xs">Support pool</p>
        </div>
        <div>
          <p className="text-warning font-semibold">
            {formatUsdcAmount(challengeTotal)} USDC
          </p>
          <p className="text-muted-foreground text-xs">Challenge pool</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-foreground font-semibold">{predictionCount}</p>
          <p className="text-muted-foreground text-xs">
            prediction{predictionCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {viewerPosition && (
        <p className="text-muted-foreground text-xs">
          You&apos;re staking{" "}
          <span className="text-foreground font-medium">
            {formatUsdcAmount(viewerPosition.amount)} USDC
          </span>{" "}
          on {viewerPosition.side === "SUPPORT" ? "Support" : "Challenge"}.
        </p>
      )}

      {isOpen && isSignedIn && !hasWallet && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isSettingUp}
          onClick={() => void setupWallet()}
        >
          {isSettingUp ? "Setting up…" : "Set up wallet to stake"}
        </Button>
      )}

      {isOpen && isSignedIn && hasWallet && (
        <div className="flex items-center gap-2">
          <Input
            type="text"
            inputMode="decimal"
            placeholder="Amount (USDC)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isPending}
            className="h-9"
          />
          <Button
            type="button"
            size="sm"
            className="bg-success hover:bg-success/90 shrink-0 text-white"
            disabled={
              isPending ||
              (viewerPosition !== null && viewerPosition.side !== "SUPPORT")
            }
            onClick={() => handleStake("SUPPORT")}
          >
            {pendingSide === "SUPPORT" ? "Staking…" : "Support"}
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-warning hover:bg-warning/90 shrink-0 text-white"
            disabled={
              isPending ||
              (viewerPosition !== null && viewerPosition.side !== "CHALLENGE")
            }
            onClick={() => handleStake("CHALLENGE")}
          >
            {pendingSide === "CHALLENGE" ? "Staking…" : "Challenge"}
          </Button>
        </div>
      )}

      {isOpen && !isSignedIn && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.push("/sign-in")}
        >
          Sign in to Support or Challenge
        </Button>
      )}
    </div>
  );
}
