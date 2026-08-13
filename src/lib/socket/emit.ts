import { getSocketServer } from "./server";
import { rooms } from "./events";
import type {
  CommentAddedPayload,
  FeedUpdatePayload,
  FollowAddedPayload,
  LikeAddedPayload,
  LiquidityUpdatedPayload,
  NotificationCreatedPayload,
  RepostAddedPayload,
  ScoreUpdatedPayload,
  SettlementCompletedPayload,
} from "./events";

export function emitFeedUpdate(payload: FeedUpdatePayload) {
  const io = getSocketServer();
  if (!io) return;
  io.emit("feed_update", payload);
}

export function emitLikeAdded(payload: LikeAddedPayload) {
  const io = getSocketServer();
  if (!io) return;
  io.to(rooms.post(payload.predictionId)).emit("like_added", payload);
}

export function emitRepostAdded(payload: RepostAddedPayload) {
  const io = getSocketServer();
  if (!io) return;
  io.to(rooms.post(payload.predictionId)).emit("repost_added", payload);
}

export function emitCommentAdded(payload: CommentAddedPayload) {
  const io = getSocketServer();
  if (!io) return;
  io.to(rooms.post(payload.predictionId)).emit("comment_added", payload);
}

export function emitFollowAdded(payload: FollowAddedPayload) {
  const io = getSocketServer();
  if (!io) return;
  io.to(rooms.user(payload.followingId)).emit("follow_added", payload);
}

export function emitNotificationCreated(payload: NotificationCreatedPayload) {
  const io = getSocketServer();
  if (!io) return;
  io.to(rooms.user(payload.userId)).emit("notification_created", payload);
}

/**
 * `rooms.match(id)` has a real subscriber as of the Match/Market detail
 * page (`src/components/match/match-header.tsx`).
 */
export function emitScoreUpdated(payload: ScoreUpdatedPayload) {
  const io = getSocketServer();
  if (!io) return;
  io.to(rooms.match(payload.matchId)).emit("score_updated", payload);
}

/**
 * Fired after a Support/Challenge stake is confirmed on-chain (see
 * `POST /api/wallet/stake-confirm`) — pool totals changed, so anyone
 * viewing this market's page should see updated numbers without a
 * refresh. No client subscribes to `rooms.market(id)` yet — the market
 * page (`src/app/matches/[id]/page.tsx`) currently renders `MarketCard`
 * as a static Server Component. Wiring a live subscriber is the natural
 * next step once staking UI actually calls this route from that page.
 */
export function emitLiquidityUpdated(payload: LiquidityUpdatedPayload) {
  const io = getSocketServer();
  if (!io) return;
  io.to(rooms.market(payload.marketId)).emit("liquidity_updated", payload);
}

/**
 * Fired when a market is successfully settled (or voided) on-chain.
 */
export function emitSettlementCompleted(payload: SettlementCompletedPayload) {
  const io = getSocketServer();
  if (!io) return;
  io.to(rooms.market(payload.marketId)).emit("settlement_completed", payload);
}
