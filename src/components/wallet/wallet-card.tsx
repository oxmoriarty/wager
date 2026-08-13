"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatUsdcAmount } from "@/lib/format";
import { useWalletSetup } from "@/lib/circle/use-wallet-setup";
import type { WalletOverview } from "@/lib/queries/wallet";

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletCard({ overview }: { overview: WalletOverview }) {
  const { isSettingUp, setupWallet } = useWalletSetup();

  if (!overview.hasWallet || !overview.arcWalletAddress) {
    return (
      <Card className="items-start gap-3">
        <p className="text-foreground font-medium">Set up your Arc wallet</p>
        <p className="text-muted-foreground text-sm">
          Wager uses a Circle-managed, non-custodial wallet on Arc Testnet — you
          hold the key, Wager never has signing authority over your funds. Set
          it up once to Support or Challenge markets with USDC.
        </p>
        <Button
          type="button"
          disabled={isSettingUp}
          onClick={() => void setupWallet()}
        >
          {isSettingUp ? "Setting up…" : "Set up wallet"}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="gap-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs tracking-wide uppercase">
          Arc wallet
        </p>
        <a
          href={`https://testnet.arcscan.app/address/${overview.arcWalletAddress}`}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground font-mono text-xs hover:underline"
        >
          {truncateAddress(overview.arcWalletAddress)}
        </a>
      </div>

      <p className="text-foreground text-2xl font-bold tabular-nums">
        {formatUsdcAmount(overview.balance ?? "0")} USDC
      </p>

      <p className="text-muted-foreground text-xs">
        Testnet USDC has no real value.{" "}
        <a
          href={overview.faucetUrl}
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline"
        >
          Get testnet USDC from the faucet
        </a>{" "}
        to Support or Challenge a market.
      </p>
    </Card>
  );
}
