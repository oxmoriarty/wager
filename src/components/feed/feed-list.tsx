"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PredictionCard } from "@/components/feed/prediction-card";
import { getSocketClient } from "@/lib/socket/client";
import type { FeedItem } from "@/lib/queries/feed";
import type { ApiSuccess } from "@/lib/api-response";

interface FeedPage {
  items: FeedItem[];
  nextCursor: string | null;
}

export function FeedList({
  initialPage,
  isAuthenticated,
}: {
  initialPage: FeedPage;
  isAuthenticated: boolean;
}) {
  const [items, setItems] = useState(initialPage.items);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasNewPosts, setHasNewPosts] = useState(false);

  useEffect(() => {
    const socket = getSocketClient();
    const handleFeedUpdate = () => setHasNewPosts(true);
    socket.on("feed_update", handleFeedUpdate);
    return () => {
      socket.off("feed_update", handleFeedUpdate);
    };
  }, []);

  async function loadFreshFeed() {
    try {
      const response = await fetch("/api/feed");
      const body = (await response.json()) as ApiSuccess<FeedPage>;
      if (body.success) {
        setItems(body.data.items);
        setNextCursor(body.data.nextCursor);
      }
    } finally {
      setHasNewPosts(false);
    }
  }

  async function loadMore() {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    try {
      const response = await fetch(`/api/feed?cursor=${nextCursor}`);
      const body = (await response.json()) as ApiSuccess<FeedPage>;
      if (body.success) {
        setItems((current) => [...current, ...body.data.items]);
        setNextCursor(body.data.nextCursor);
      }
    } finally {
      setIsLoadingMore(false);
    }
  }

  if (items.length === 0) {
    return (
      <Card className="text-muted-foreground py-10 text-center text-sm">
        No predictions yet. Be the first to post one above.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {hasNewPosts && (
        <button
          onClick={loadFreshFeed}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
        >
          New predictions — tap to refresh
        </button>
      )}

      {items.map((prediction) => (
        <PredictionCard
          key={prediction.id}
          prediction={prediction}
          isAuthenticated={isAuthenticated}
        />
      ))}

      {nextCursor && (
        <Button
          variant="outline"
          onClick={loadMore}
          disabled={isLoadingMore}
          className="self-center"
        >
          {isLoadingMore ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
