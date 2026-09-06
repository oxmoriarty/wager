"use client";

import { useEffect, useState } from "react";
import { getSocketClient } from "@/lib/socket/client";
import { rooms } from "@/lib/socket/events";
import type { CommentNode, CommentSortMode } from "@/lib/queries/comments";
import {
  CommentComposer,
  type ReplyTarget,
} from "@/components/feed/comment-composer";
import { CommentList } from "@/components/feed/comment-list";
import type { ApiSuccess } from "@/lib/api-response";

function insertReplyIntoTree(
  nodes: CommentNode[],
  newReply: CommentNode,
): boolean {
  for (const node of nodes) {
    if (node.id === newReply.parentId) {
      if (!node.replies.some((r) => r.id === newReply.id)) {
        node.replies.push(newReply);
      }
      return true;
    }
    if (node.replies.length > 0) {
      const inserted = insertReplyIntoTree(node.replies, newReply);
      if (inserted) return true;
    }
  }
  return false;
}

export function ConversationView({
  predictionId,
  initialComments,
  totalCount,
  isAuthenticated,
  currentUser,
}: {
  predictionId: string;
  initialComments: CommentNode[];
  totalCount: number;
  isAuthenticated: boolean;
  currentUser?: {
    name?: string | null;
    image?: string | null;
  } | null;
}) {
  const [comments, setComments] = useState<CommentNode[]>(initialComments);
  const [count, setCount] = useState<number>(totalCount);
  const [sortMode, setSortMode] = useState<CommentSortMode>("conversational");
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);

  useEffect(() => {
    setComments(initialComments);
    setCount(totalCount);
  }, [initialComments, totalCount]);

  async function refreshComments(currentSort = sortMode) {
    try {
      const res = await fetch(
        `/api/predictions/${predictionId}/comments?sort=${currentSort}`,
      );
      const body = (await res.json()) as ApiSuccess<{
        items: CommentNode[];
        totalCount: number;
      }>;
      if (body.success) {
        setComments(body.data.items);
        setCount(body.data.totalCount);
      }
    } catch {
      // non-critical
    }
  }

  function handleSortChange(newSort: CommentSortMode) {
    setSortMode(newSort);
    refreshComments(newSort);
  }

  function handleSelectReply(target: ReplyTarget) {
    setReplyTarget(target);
    const composerEl = document.getElementById("comment-composer");
    if (composerEl) {
      composerEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function handleCancelReply() {
    setReplyTarget(null);
  }

  function handleCommentSubmitted(newComment: CommentNode) {
    setComments((prev) => {
      const cloned = JSON.parse(JSON.stringify(prev)) as CommentNode[];
      if (newComment.parentId) {
        const placed = insertReplyIntoTree(cloned, newComment);
        if (!placed) {
          cloned.push(newComment);
        }
      } else {
        if (sortMode === "latest") {
          cloned.unshift(newComment);
        } else {
          cloned.push(newComment);
        }
      }
      return cloned;
    });
    setCount((prev) => prev + 1);
    setReplyTarget(null);
  }

  useEffect(() => {
    const socket = getSocketClient();
    const room = rooms.post(predictionId);
    socket.emit("join", room);

    const handleCommentEvent = () => {
      refreshComments();
    };

    socket.on("comment_added", handleCommentEvent);
    window.addEventListener("wager:comment_added", handleCommentEvent);

    return () => {
      socket.emit("leave", room);
      socket.off("comment_added", handleCommentEvent);
      window.removeEventListener("wager:comment_added", handleCommentEvent);
    };
  }, [predictionId, sortMode]);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Reply Composer (Section 7: placed right under the prediction post) ── */}
      <CommentComposer
        predictionId={predictionId}
        isAuthenticated={isAuthenticated}
        currentUser={currentUser}
        replyTarget={replyTarget}
        onCancelReply={handleCancelReply}
        onCommentSubmitted={handleCommentSubmitted}
      />

      {/* ── Threaded Reply Tree ── */}
      <CommentList
        predictionId={predictionId}
        comments={comments}
        totalCount={count}
        isAuthenticated={isAuthenticated}
        sortMode={sortMode}
        onSortChange={handleSortChange}
        onSelectReply={handleSelectReply}
      />
    </div>
  );
}
