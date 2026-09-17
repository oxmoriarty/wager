"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PenLine, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { Textarea } from "@/components/ui/textarea";
import { createPredictionSchema } from "@/lib/validation/prediction";
import { MARKET_TYPE_LABEL } from "@/lib/market-labels";
import { executeCircleChallenge } from "@/lib/circle/web-sdk";
import type { ComposerMarket } from "@/lib/queries/feed";
import type { ApiError, ApiSuccess } from "@/lib/api-response";

const CONTENT_MAX_LENGTH = 500;
const CIRCLE_APP_ID = process.env.NEXT_PUBLIC_CIRCLE_APP_ID;

type StakeChallengeData = {
  challengeId: string;
  userToken: string;
  encryptionKey: string;
};

async function parseApiJson<T>(res: Response): Promise<ApiSuccess<T> | ApiError> {
  return (await res.json()) as ApiSuccess<T> | ApiError;
}

export function PredictionComposer({
  markets,
  isAuthenticated,
  hasWallet,
}: {
  markets: ComposerMarket[];
  isAuthenticated: boolean;
  hasWallet: boolean;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [marketId, setMarketId] = useState(markets[0]?.id ?? "");
  const [side, setSide] = useState<"SUPPORT" | "CHALLENGE" | null>(null);
  const [stakeAmount, setStakeAmount] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("compose") === "true") {
        setIsOpen(true);
      }
    }
  }, []);

  function handleSideClick(selected: "SUPPORT" | "CHALLENGE") {
    if (!hasWallet) return;
    setSide((prev) => {
      if (prev === selected) {
        setStakeAmount(""); // clear amount when deselecting
        return null;
      }
      return selected;
    });
  }

  function resetForm() {
    setIsOpen(false);
    setError(null);
    setSide(null);
    setStakeAmount("");
    setContent("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Require a stake amount whenever a side is chosen
    if (side && hasWallet) {
      if (!stakeAmount || !/^\d+(\.\d{1,6})?$/.test(stakeAmount) || Number(stakeAmount) <= 0) {
        setError("Enter a valid USDC amount to stake on your position.");
        return;
      }
    }

    const parsed = createPredictionSchema.safeParse({
      marketId,
      side,
      stakeAmount: side ? stakeAmount : null,
      content,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid prediction.");
      return;
    }

    setIsSubmitting(true);
    try {
      // ── Step 1: execute Circle stake if a side was chosen ──────────────
      if (side && stakeAmount && hasWallet) {
        if (!CIRCLE_APP_ID) {
          toast.error("Staking isn't configured — missing CIRCLE_APP_ID.");
          return;
        }

        const challengeRes = await fetch("/api/wallet/stake-challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketId, side, amount: stakeAmount }),
        });
        const challengeBody = await parseApiJson<StakeChallengeData>(challengeRes);
        if (!challengeBody.success) {
          toast.error(challengeBody.message);
          return;
        }

        // Biometric / PIN circle challenge
        await executeCircleChallenge({
          appId: CIRCLE_APP_ID,
          ...challengeBody.data,
        });

        const confirmRes = await fetch("/api/wallet/stake-confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketId, side, amount: stakeAmount }),
        });
        const confirmBody = await parseApiJson<{ amount: string }>(confirmRes);
        if (!confirmBody.success) {
          toast.error(confirmBody.message);
          return;
        }
      }

      // ── Step 2: create prediction post ────────────────────────────────
      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json()) as ApiSuccess<unknown> | ApiError;

      if (!body.success) {
        toast.error(body.message);
        return;
      }

      resetForm();
      toast.success(side ? "Position staked & prediction posted!" : "Prediction posted.");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isAuthenticated) {
    return null; // Unauthenticated users see no composer
  }

  if (markets.length === 0) {
    return (
      <Card className="text-muted-foreground text-center text-sm">
        No markets are open right now. Check back once new fixtures are
        discovered.
      </Card>
    );
  }

  return (
    <>
      {/* Collapsed composer: click to expand */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="border-border bg-card text-muted-foreground hover:border-primary/50 flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors"
        >
          <PenLine className="size-4 shrink-0" />
          <span>What's your prediction?</span>
        </button>
      )}

      {/* Expanded composer */}
      {isOpen && (
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-foreground text-sm font-medium">
              New prediction
            </span>
            <button
              type="button"
              onClick={resetForm}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>

          <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
            <SelectNative
              value={marketId}
              onChange={(e) => setMarketId(e.target.value)}
              disabled={isSubmitting}
            >
              {markets.map((market) => (
                <option key={market.id} value={market.id}>
                  {market.match.homeTeam} vs {market.match.awayTeam} ·{" "}
                  {MARKET_TYPE_LABEL[market.type] ?? market.type}
                </option>
              ))}
            </SelectNative>

            <Textarea
              placeholder="Share your take…"
              value={content}
              maxLength={CONTENT_MAX_LENGTH}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSubmitting}
            />

            {/* Side selector */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={side === "SUPPORT" ? "default" : "outline"}
                  onClick={() => handleSideClick("SUPPORT")}
                  disabled={isSubmitting || !hasWallet}
                  title={!hasWallet ? "Set up your wallet to enter a market" : undefined}
                >
                  Support
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={side === "CHALLENGE" ? "default" : "outline"}
                  onClick={() => handleSideClick("CHALLENGE")}
                  disabled={isSubmitting || !hasWallet}
                  title={!hasWallet ? "Set up your wallet to enter a market" : undefined}
                >
                  Challenge
                </Button>
              </div>

              {/* Stake amount — appears when a side is selected and wallet is ready */}
              {side && hasWallet && (
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="Stake amount (USDC)"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    disabled={isSubmitting}
                    className="h-9"
                    autoFocus
                  />
                  <span className="text-muted-foreground shrink-0 text-xs font-medium">
                    USDC
                  </span>
                </div>
              )}

              {!hasWallet && (
                <p className="text-muted-foreground text-xs">
                  <Link href="/wallet" className="underline underline-offset-2">
                    Set up your wallet
                  </Link>{" "}
                  to enter a market and stake USDC.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              {error && <p className="text-destructive text-sm">{error}</p>}
              <span className="text-muted-foreground ml-auto text-xs">
                {content.length}/{CONTENT_MAX_LENGTH}
              </span>
            </div>

            <Button type="submit" disabled={isSubmitting} className="self-end">
              {isSubmitting
                ? side ? "Staking & posting…" : "Posting…"
                : side ? "Stake & post prediction" : "Post prediction"}
            </Button>
          </form>
        </Card>

      )}

      {/* Sticky floating action button — always visible to quick-open composer */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 fixed right-5 bottom-6 z-50 flex size-14 items-center justify-center rounded-full shadow-lg transition-colors sm:right-8"
          aria-label="New prediction"
        >
          <PenLine className="size-5" />
        </button>
      )}
    </>
  );
}

