"use client";

import { useState } from "react";
import { ArrowUpRight, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { executeCircleChallenge } from "@/lib/circle/web-sdk";
import { formatUsdcAmount } from "@/lib/format";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: string;
  onSuccess?: () => void;
}

const CIRCLE_APP_ID = process.env.NEXT_PUBLIC_CIRCLE_APP_ID;

export function WithdrawModal({
  isOpen,
  onClose,
  availableBalance,
  onSuccess,
}: WithdrawModalProps) {
  const [destinationAddress, setDestinationAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const maxAmount = Number(availableBalance) || 0;

  function handleSetMax() {
    // Leave a small buffer (0.002 USDC) for native gas fee on Arc Testnet
    const maxVal = Math.max(0, maxAmount - 0.002);
    setAmount(maxVal > 0 ? maxVal.toFixed(4) : availableBalance);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!CIRCLE_APP_ID) {
      toast.error("Circle App ID is not configured.");
      return;
    }

    const trimmedAddress = destinationAddress.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmedAddress)) {
      toast.error("Please enter a valid 0x wallet address.");
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid withdrawal amount.");
      return;
    }

    if (numAmount > maxAmount) {
      toast.error(`Amount exceeds available balance (${formatUsdcAmount(availableBalance)} USDC).`);
      return;
    }

    setIsSubmitting(true);
    try {
      // Step 1: Request withdrawal challenge
      const challengeRes = await fetch("/api/wallet/withdraw-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationAddress: trimmedAddress,
          amount: numAmount.toFixed(6).replace(/\.?0+$/, ""),
        }),
      });

      const challengeData = await challengeRes.json().catch(() => null);
      if (!challengeRes.ok || !challengeData || challengeData.status === "error") {
        toast.error(challengeData?.message ?? "Failed to start withdrawal. Please try again.");
        return;
      }

      const { challengeId, userToken, encryptionKey } = challengeData.data;

      // Step 2: Prompt Circle PIN/passkey modal
      await executeCircleChallenge({
        appId: CIRCLE_APP_ID,
        userToken,
        encryptionKey,
        challengeId,
      });

      // Step 3: Confirm withdrawal on server
      const confirmRes = await fetch("/api/wallet/withdraw-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationAddress: trimmedAddress,
          amount: numAmount.toFixed(6).replace(/\.?0+$/, ""),
        }),
      });

      const confirmData = await confirmRes.json().catch(() => null);
      if (!confirmRes.ok || !confirmData || confirmData.status === "error") {
        toast.error(confirmData?.message ?? "Failed to confirm withdrawal record.");
      } else {
        toast.success(`Withdrew ${amount} USDC successfully!`);
      }

      onClose();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Withdrawal error:", error);
      const isNetworkErr = error instanceof TypeError && error.message.toLowerCase().includes("fetch");
      toast.error(
        isNetworkErr
          ? "Network connection interrupted. Please try again in a moment."
          : error instanceof Error
            ? error.message
            : "Withdrawal failed. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 text-white">
              <ArrowUpRight className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Withdraw USDC
              </h2>
              <p className="text-xs text-muted-foreground">
                Transfer funds to an external Arc wallet
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-zinc-800 hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Recipient Address (Arc Testnet)
            </label>
            <Input
              type="text"
              placeholder="0x..."
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
              disabled={isSubmitting}
              className="mt-1.5 font-mono text-xs h-10"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Amount (USDC)
              </label>
              <button
                type="button"
                onClick={handleSetMax}
                className="text-xs font-medium text-emerald-400 hover:underline"
              >
                Max: {formatUsdcAmount(availableBalance)} USDC
              </button>
            </div>
            <div className="relative mt-1.5">
              <Input
                type="number"
                step="any"
                min="0.000001"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isSubmitting}
                className="h-10 pr-16 font-semibold"
                required
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground">
                USDC
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-zinc-900/50 p-3 text-xs text-muted-foreground">
            Transfers are processed on Arc Testnet via your non-custodial Circle wallet. You will enter your PIN to authorize.
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-1/2 h-10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || maxAmount <= 0}
              className="w-1/2 h-10 font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authorizing…
                </>
              ) : (
                "Withdraw"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
