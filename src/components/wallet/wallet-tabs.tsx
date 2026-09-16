"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Clock,
  Coins,
  ExternalLink,
  History,
  Sparkles,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatRelativeTime, formatUsdcAmount } from "@/lib/format";
import { MARKET_TYPE_LABEL } from "@/lib/market-labels";
import { executeCircleChallenge } from "@/lib/circle/web-sdk";
import type { PositionRow, TransactionRow } from "@/lib/queries/wallet";

const CIRCLE_APP_ID = process.env.NEXT_PUBLIC_CIRCLE_APP_ID;

type TabKey = "positions" | "history";
type PositionFilter = "all" | "open" | "claimable" | "closed";
type TxFilter = "all" | "in" | "out";

// --- Claim Button Component ---
function ClaimButton({
  position,
  onClaimed,
}: {
  position: PositionRow;
  onClaimed: (marketId: string) => void;
}) {
  const [isClaiming, setIsClaiming] = useState(false);

  async function handleClaim(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!CIRCLE_APP_ID) {
      toast.error("Circle App ID is not configured.");
      return;
    }

    setIsClaiming(true);
    try {
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

      await executeCircleChallenge({
        appId: CIRCLE_APP_ID,
        userToken,
        encryptionKey,
        challengeId,
      });

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
      variant="default"
      disabled={isClaiming}
      onClick={handleClaim}
      className={`h-8 px-3 text-xs font-semibold shadow-md transition-all ${
        position.status === "VOID"
          ? "bg-zinc-200 text-zinc-900 hover:bg-white"
          : "bg-emerald-500 text-zinc-950 hover:bg-emerald-400 font-bold"
      }`}
    >
      {isClaiming ? (
        "Claiming…"
      ) : position.status === "VOID" ? (
        "Claim Refund"
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Claim Payout</span>
        </span>
      )}
    </Button>
  );
}

// --- Main WalletTabs Component ---
export function WalletTabs({
  positions: initialPositions,
  transactions,
}: {
  positions: PositionRow[];
  transactions: TransactionRow[];
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("positions");
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("all");
  const [txFilter, setTxFilter] = useState<TxFilter>("all");
  const [positions, setPositions] = useState(initialPositions);

  function handleClaimed(marketId: string) {
    setPositions((prev) =>
      prev.map((p) =>
        p.market.id === marketId ? { ...p, status: "CLAIMED" } : p,
      ),
    );
  }

  const claimableCount = positions.filter(
    (p) => p.status === "WON" || p.status === "VOID",
  ).length;

  const filteredPositions = positions.filter((p) => {
    if (positionFilter === "open") return p.status === "OPEN";
    if (positionFilter === "claimable")
      return p.status === "WON" || p.status === "VOID";
    if (positionFilter === "closed")
      return p.status === "CLAIMED" || p.status === "LOST";
    return true;
  });

  const filteredTransactions = transactions.filter((tx) => {
    const isIncoming =
      tx.type === "DEPOSIT" ||
      tx.type === "CLAIM" ||
      tx.type === "PAYOUT" ||
      tx.type === "ESCROW_RELEASE";
    const isOutgoing = tx.type === "WITHDRAWAL" || tx.type === "ESCROW_LOCK";

    if (txFilter === "in") return isIncoming;
    if (txFilter === "out") return isOutgoing;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Horizontal Tabs Switcher */}
      <div className="flex rounded-xl border border-zinc-800 bg-zinc-950/80 p-1.5 shadow-inner">
        <button
          type="button"
          onClick={() => setActiveTab("positions")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold tracking-wider uppercase transition-all ${
            activeTab === "positions"
              ? "bg-zinc-800 text-white shadow-sm"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Trophy className="h-4 w-4" />
          <span>Positions</span>
          {positions.length > 0 && (
            <span
              className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                claimableCount > 0
                  ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                  : activeTab === "positions"
                    ? "bg-zinc-700 text-zinc-200"
                    : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {positions.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold tracking-wider uppercase transition-all ${
            activeTab === "history"
              ? "bg-zinc-800 text-white shadow-sm"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <History className="h-4 w-4" />
          <span>Transaction History</span>
          {transactions.length > 0 && (
            <span
              className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                activeTab === "history"
                  ? "bg-zinc-700 text-zinc-200"
                  : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {transactions.length}
            </span>
          )}
        </button>
      </div>

      {/* POSITIONS TAB CONTENT */}
      {activeTab === "positions" && (
        <div className="space-y-3">
          {/* Sub-filters */}
          {positions.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setPositionFilter("all")}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  positionFilter === "all"
                    ? "bg-zinc-200 text-zinc-950"
                    : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                }`}
              >
                All ({positions.length})
              </button>
              <button
                type="button"
                onClick={() => setPositionFilter("open")}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  positionFilter === "open"
                    ? "bg-zinc-200 text-zinc-950"
                    : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                }`}
              >
                Open ({positions.filter((p) => p.status === "OPEN").length})
              </button>
              <button
                type="button"
                onClick={() => setPositionFilter("claimable")}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  positionFilter === "claimable"
                    ? "bg-emerald-400 text-zinc-950 font-semibold"
                    : claimableCount > 0
                      ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/80"
                      : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                }`}
              >
                Claimable ({claimableCount})
              </button>
              <button
                type="button"
                onClick={() => setPositionFilter("closed")}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  positionFilter === "closed"
                    ? "bg-zinc-200 text-zinc-950"
                    : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                }`}
              >
                Closed
              </button>
            </div>
          )}

          {/* Positions List */}
          {filteredPositions.length === 0 ? (
            <Card className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 py-12 text-center">
              <Coins className="h-8 w-8 text-zinc-500" />
              <p className="text-sm font-medium text-zinc-300">
                {positions.length === 0
                  ? "You haven't staked on any matches yet."
                  : "No positions match this filter."}
              </p>
              {positions.length === 0 && (
                <Link href="/matches">
                  <Button size="sm" variant="outline" className="mt-2 text-xs">
                    Explore Upcoming Matches
                  </Button>
                </Link>
              )}
            </Card>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredPositions.map((position) => {
                const isClaimable =
                  position.status === "WON" || position.status === "VOID";

                return (
                  <Link
                    key={position.id}
                    href={`/matches/${position.market.match.id}`}
                  >
                    <Card
                      className={`group flex-row items-center justify-between gap-3.5 rounded-xl border p-4 transition-all hover:border-zinc-700 ${
                        isClaimable
                          ? "border-emerald-500/50 bg-gradient-to-r from-emerald-950/20 to-zinc-900/80 shadow-md"
                          : "border-zinc-800/90 bg-zinc-900/80 hover:bg-zinc-900"
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-semibold text-white group-hover:text-zinc-100">
                          {position.market.match.homeTeam} vs{" "}
                          {position.market.match.awayTeam}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                          <span>
                            {MARKET_TYPE_LABEL[position.market.type] ??
                              position.market.type}
                          </span>
                          <span>•</span>
                          <span
                            className={
                              position.side === "SUPPORT"
                                ? "text-emerald-400 font-medium"
                                : "text-amber-400 font-medium"
                            }
                          >
                            {position.side === "SUPPORT"
                              ? "Support (Home)"
                              : "Challenge (Away)"}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-bold text-white tabular-nums">
                            {formatUsdcAmount(position.amount)} USDC
                          </p>
                          <p className="text-[11px] text-zinc-400">
                            {formatRelativeTime(position.createdAt)}
                          </p>
                        </div>

                        {isClaimable ? (
                          <ClaimButton
                            position={position}
                            onClaimed={handleClaimed}
                          />
                        ) : position.status === "OPEN" ? (
                          <Badge
                            variant="outline"
                            className="border-zinc-700 text-zinc-300"
                          >
                            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Open
                          </Badge>
                        ) : position.status === "CLAIMED" ? (
                          <Badge
                            variant="secondary"
                            className="bg-zinc-800 text-zinc-400"
                          >
                            <Check className="mr-1 h-3 w-3 text-emerald-400" />
                            Claimed
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-zinc-800 text-zinc-500"
                          >
                            Lost
                          </Badge>
                        )}
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TRANSACTION HISTORY TAB CONTENT */}
      {activeTab === "history" && (
        <div className="space-y-3">
          {/* Sub-filters for Transactions */}
          {transactions.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setTxFilter("all")}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  txFilter === "all"
                    ? "bg-zinc-200 text-zinc-950"
                    : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setTxFilter("in")}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  txFilter === "in"
                    ? "bg-emerald-400 text-zinc-950 font-semibold"
                    : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                }`}
              >
                Funds In (Deposits & Payouts)
              </button>
              <button
                type="button"
                onClick={() => setTxFilter("out")}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  txFilter === "out"
                    ? "bg-amber-400 text-zinc-950 font-semibold"
                    : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                }`}
              >
                Funds Out (Stakes & Withdrawals)
              </button>
            </div>
          )}

          {/* Transactions List */}
          {filteredTransactions.length === 0 ? (
            <Card className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 py-12 text-center">
              <Clock className="h-8 w-8 text-zinc-500" />
              <p className="text-sm font-medium text-zinc-300">
                No transactions recorded yet.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredTransactions.map((tx) => {
                const isIncoming =
                  tx.type === "DEPOSIT" ||
                  tx.type === "CLAIM" ||
                  tx.type === "PAYOUT" ||
                  tx.type === "ESCROW_RELEASE";

                let title = "Transaction";
                if (tx.type === "DEPOSIT") title = "Deposit";
                else if (tx.type === "WITHDRAWAL") title = "Withdrawal";
                else if (tx.type === "ESCROW_LOCK") title = "Entered Position";
                else if (tx.type === "CLAIM" || tx.type === "PAYOUT")
                  title = "Winnings Claimed";
                else if (tx.type === "ESCROW_RELEASE")
                  title = "Refund Released";

                return (
                  <Card
                    key={tx.id}
                    className="flex-row items-center justify-between gap-3.5 rounded-xl border border-zinc-800/80 bg-zinc-900/80 p-3.5 transition-colors hover:border-zinc-700"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          isIncoming
                            ? "bg-emerald-500/15 text-emerald-400"
                            : tx.type === "WITHDRAWAL"
                              ? "bg-amber-500/15 text-amber-400"
                              : "bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        {isIncoming ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {title}
                        </p>
                        <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                          <span>{formatRelativeTime(tx.createdAt)}</span>
                          {tx.arcTxHash && (
                            <>
                              <span>•</span>
                              <a
                                href={`https://testnet.arcscan.app/tx/${tx.arcTxHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
                              >
                                <span>Arcscan</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-bold tabular-nums ${
                          isIncoming ? "text-emerald-400" : "text-white"
                        }`}
                      >
                        {isIncoming ? "+" : "-"}
                        {formatUsdcAmount(tx.amount)} USDC
                      </p>
                      <span className="text-[10px] uppercase font-semibold text-zinc-500">
                        {tx.status}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
