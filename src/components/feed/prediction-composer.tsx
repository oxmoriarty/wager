"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectNative } from "@/components/ui/select-native";
import { Textarea } from "@/components/ui/textarea";
import { createPredictionSchema } from "@/lib/validation/prediction";
import { MARKET_TYPE_LABEL } from "@/lib/market-labels";
import type { ComposerMarket } from "@/lib/queries/feed";
import type { ApiError, ApiSuccess } from "@/lib/api-response";

const CONTENT_MAX_LENGTH = 500;

export function PredictionComposer({ markets }: { markets: ComposerMarket[] }) {
  const router = useRouter();
  const [marketId, setMarketId] = useState(markets[0]?.id ?? "");
  const [side, setSide] = useState<"SUPPORT" | "CHALLENGE" | null>(null);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (markets.length === 0) {
    return (
      <Card className="text-muted-foreground text-center text-sm">
        No markets are open right now. Check back once new fixtures are
        discovered.
      </Card>
    );
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
      toast.success("Prediction posted.");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
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
          placeholder="What's your prediction?"
          value={content}
          maxLength={CONTENT_MAX_LENGTH}
          onChange={(e) => setContent(e.target.value)}
          disabled={isSubmitting}
        />

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={side === "SUPPORT" ? "default" : "outline"}
              onClick={() => setSide("SUPPORT")}
              disabled={isSubmitting}
            >
              Support
            </Button>
            <Button
              type="button"
              size="sm"
              variant={side === "CHALLENGE" ? "default" : "outline"}
              onClick={() => setSide("CHALLENGE")}
              disabled={isSubmitting}
            >
              Challenge
            </Button>
          </div>
          <span className="text-muted-foreground text-xs">
            {content.length}/{CONTENT_MAX_LENGTH}
          </span>
        </div>

        {error && <p className="text-error text-sm">{error}</p>}

        <Button type="submit" disabled={isSubmitting} className="self-end">
          {isSubmitting ? "Posting…" : "Post prediction"}
        </Button>
      </form>
    </Card>
  );
}
