/**
 * Shared Socket.IO contract. Keeping event and room names in one typed
 * module means the server and client can never drift apart.
 *
 * Rooms (PROJECT.md §8):
 *   user:{id}   — private events for a specific user (notifications, wallet)
 *   market:{id} — odds/liquidity updates for a market
 *   match:{id}  — live score updates for a match
 *   post:{id}   — likes/comments/reposts on a prediction post
 */

export const rooms = {
  user: (userId: string) => `user:${userId}`,
  market: (marketId: string) => `market:${marketId}`,
  match: (matchId: string) => `match:${matchId}`,
  post: (predictionId: string) => `post:${predictionId}`,
} as const;

export interface FeedUpdatePayload {
  predictionId: string;
}

export interface CommentAddedPayload {
  predictionId: string;
  commentId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface LikeAddedPayload {
  predictionId: string;
  userId: string;
  likeCount: number;
}

export interface RepostAddedPayload {
  predictionId: string;
  userId: string;
  repostCount: number;
}

export interface FollowAddedPayload {
  followerId: string;
  followingId: string;
}

export interface OddsUpdatedPayload {
  marketId: string;
  totalSupportAmount: string;
  totalChallengeAmount: string;
}

export interface LiquidityUpdatedPayload {
  marketId: string;
  totalSupportAmount: string;
  totalChallengeAmount: string;
}

export interface ScoreUpdatedPayload {
  matchId: string;
  homeScore: number;
  awayScore: number;
  status: string;
}

export interface SettlementCompletedPayload {
  marketId: string;
  outcome: string;
  settledAt: string;
}

export interface NotificationCreatedPayload {
  notificationId: string;
  userId: string;
  type: string;
  message: string;
  createdAt: string;
}

/** Server -> client events. */
export interface ServerToClientEvents {
  feed_update: (payload: FeedUpdatePayload) => void;
  comment_added: (payload: CommentAddedPayload) => void;
  like_added: (payload: LikeAddedPayload) => void;
  repost_added: (payload: RepostAddedPayload) => void;
  follow_added: (payload: FollowAddedPayload) => void;
  odds_updated: (payload: OddsUpdatedPayload) => void;
  liquidity_updated: (payload: LiquidityUpdatedPayload) => void;
  score_updated: (payload: ScoreUpdatedPayload) => void;
  settlement_completed: (payload: SettlementCompletedPayload) => void;
  notification_created: (payload: NotificationCreatedPayload) => void;
}

/** Client -> server events. */
export interface ClientToServerEvents {
  join: (room: string) => void;
  leave: (room: string) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId?: string;
}
