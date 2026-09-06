"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PenLine, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectNative } from "@/components/ui/select-native";
import { Textarea } from "@/components/ui/textarea";
import { createPredictionSchema } from "@/lib/validation/prediction";
import { MARKET_TYPE_LABEL } from "@/lib/market-labels";
import type { ComposerMarket } from "@/lib/queries/feed";
import type { ApiError, ApiSuccess } from "@/lib/api-response";

const CONTENT_MAX_LENGTH = 500;

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
    if (!hasWallet) return; // wallet gate enforced by disabled state
    setSide((prev) => (prev === selected ? null : selected));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = createPredictionSchema.safeParse({
      marketId,
      side,
      content,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid prediction.");
      return;
    }

    setIsSubmitting(true);
    try {
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

      setContent("");
      setSide(null);
      setIsOpen(false);
      toast.success("Prediction posted.");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
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
              onClick={() => {
                setIsOpen(false);
                setError(null);
                setSide(null);
                setContent("");
              }}
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

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
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
                {!hasWallet && (
                  <p className="text-muted-foreground text-xs">
                    <Link href="/wallet" className="underline underline-offset-2">
                      Set up your wallet
                    </Link>{" "}
                    to enter a market and stake USDC.
                  </p>
                )}
              </div>
              <span className="text-muted-foreground text-xs">
                {content.length}/{CONTENT_MAX_LENGTH}
              </span>
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button type="submit" disabled={isSubmitting} className="self-end">
              {isSubmitting ? "Posting…" : "Post prediction"}
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

