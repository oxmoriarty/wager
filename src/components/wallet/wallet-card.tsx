"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, Copy, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatUsdcAmount } from "@/lib/format";
import { useWalletSetup } from "@/lib/circle/use-wallet-setup";
import type { RewardsStats, WalletOverview } from "@/lib/queries/wallet";
import { DepositModal } from "./deposit-modal";
import { WithdrawModal } from "./withdraw-modal";
import { useRouter } from "next/navigation";

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

interface WalletCardProps {
  overview: WalletOverview;
  rewardsStats: RewardsStats;
}

export function WalletCard({ overview, rewardsStats }: WalletCardProps) {
  const router = useRouter();
  const { isSettingUp, setupWallet } = useWalletSetup();
  const [copied, setCopied] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);

  async function handleCopyAddress(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!overview.arcWalletAddress) return;

    try {
      await navigator.clipboard.writeText(overview.arcWalletAddress);
      setCopied(true);
      toast.success("Wallet address copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy address");
    }
  }

  if (!overview.hasWallet || !overview.arcWalletAddress) {
    return (
      <Card className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 via-zinc-900/95 to-zinc-950 p-6 shadow-xl">
        <div className="flex flex-col items-start gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-white shadow-inner">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              Activate Your In-App Wallet
            </h2>
            <p className="mt-1 text-xs text-zinc-400 leading-relaxed max-w-md">
              Wager uses an embedded, non-custodial Arc wallet powered by Circle. Set up a secure PIN once to deposit, stake USDC on predictions, and claim winnings instantly.
            </p>
          </div>
          <Button
            type="button"
            disabled={isSettingUp}
            onClick={() => void setupWallet()}
            className="mt-1 h-10 px-5 font-medium"
          >
            {isSettingUp ? "Setting up wallet…" : "Set Up Wallet"}
          </Button>
        </div>
      </Card>
    );
  }

  const balance = overview.balance ?? "0";

  return (
    <>
      <Card className="relative overflow-hidden rounded-2xl border border-zinc-800/90 bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-zinc-950 p-6 shadow-xl">
        {/* Top bar: Network label + Clickable Copy Address Pill */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Arc Testnet
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyAddress}
            title="Click to copy address"
            className="group inline-flex items-center gap-1.5 rounded-full border border-zinc-700/80 bg-zinc-800/80 px-3 py-1 font-mono text-xs font-medium text-zinc-300 transition-all hover:border-zinc-500 hover:bg-zinc-700 hover:text-white"
          >
            <span>{truncateAddress(overview.arcWalletAddress)}</span>
            {copied ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3 text-zinc-400 group-hover:text-white transition-colors" />
            )}
          </button>
        </div>

        {/* Balance Display */}
        <div className="mt-5">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            Total Balance
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-white tabular-nums sm:text-4xl">
              {formatUsdcAmount(balance)}
            </span>
            <span className="text-base font-semibold text-zinc-400">
              USDC
            </span>
          </div>
        </div>

        {/* Action Buttons: Deposit & Withdraw */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="default"
            className="h-10 gap-2 font-medium bg-zinc-100 text-zinc-900 hover:bg-white transition-all shadow-sm"
            onClick={() => setIsDepositOpen(true)}
          >
            <ArrowDownLeft className="h-4 w-4" />
            <span>Deposit</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2 font-medium border-zinc-700 bg-zinc-800/80 text-white hover:bg-zinc-700 hover:border-zinc-600 transition-all"
            onClick={() => setIsWithdrawOpen(true)}
          >
            <ArrowUpRight className="h-4 w-4" />
            <span>Withdraw</span>
          </Button>
        </div>

        {/* Rewards / Lifetime Claimed Stats Row (if any claimed) */}
        {rewardsStats.claimCount > 0 && (
          <div className="mt-5 flex items-center justify-between border-t border-zinc-800/80 pt-4 text-xs">
            <span className="text-zinc-400 font-medium">
              Total Rewards Claimed
            </span>
            <span className="font-semibold text-emerald-400 tabular-nums">
              +{formatUsdcAmount(rewardsStats.totalClaimed)} USDC
            </span>
          </div>
        )}
      </Card>

      {/* Modals */}
      <DepositModal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        address={overview.arcWalletAddress}
      />

      <WithdrawModal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        availableBalance={balance}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </>
  );
}
