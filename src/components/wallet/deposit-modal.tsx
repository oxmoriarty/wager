"use client";

import { useState } from "react";
import { Check, Copy, QrCode, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
}

export function DepositModal({ isOpen, onClose, address }: DepositModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Address copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy address");
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
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Receive / Deposit Funds
              </h2>
              <p className="text-xs text-muted-foreground">
                Arc Testnet Wallet
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-zinc-800 hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Send native <strong className="text-foreground">USDC</strong> or gas tokens to your embedded Arc wallet address below.
          </p>

          <div className="rounded-xl border border-border/80 bg-zinc-900/90 p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Your Wallet Address
            </p>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-black/60 px-3 py-2.5 font-mono text-xs text-foreground">
              <span className="break-all select-all font-mono leading-relaxed">
                {address}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5 h-8 px-2.5 text-xs font-medium"
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-zinc-900/50 p-3.5 text-xs space-y-1.5">
            <div className="flex justify-between text-muted-foreground">
              <span>Network:</span>
              <span className="font-medium text-foreground">Arc Testnet</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Chain ID:</span>
              <span className="font-mono text-foreground">5042002</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Asset:</span>
              <span className="font-medium text-foreground">USDC (Native)</span>
            </div>
          </div>

          <Button
            type="button"
            className="w-full h-10 font-medium"
            onClick={onClose}
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
