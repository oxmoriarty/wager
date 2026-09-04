import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { claimChallengeSchema } from "@/lib/validation/wallet";
import { toOnChainMarketId } from "@/lib/arc/market-id";
import {
  createCircleUserToken,
  createClaimChallenge,
} from "@/lib/circle/client";

/**
 * Starts a claim for payout (settled market) or refund (voided market).
 * Returns everything the client needs to execute the Circle challenge.
 * The actual Position status update and Transaction record are only
 * written once the client calls `POST /api/wallet/claim-confirm`,
 * which independently re-verifies the on-chain transaction.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return apiError("You must be signed in.", 401, "UNAUTHENTICATED");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Request body must be valid JSON.", 400);
  }

  const parsed = claimChallengeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Invalid request.",
      422,
      "VALIDATION_ERROR",
    );
  }

  const { marketId } = parsed.data;
  const userId = session.user.id;

  const [market, user, position] = await Promise.all([
    prisma.market.findUnique({
      where: { id: marketId },
      select: { id: true, status: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { circleWalletId: true, arcWalletAddress: true },
    }),
    prisma.position.findUnique({
      where: { userId_marketId: { userId, marketId } },
      select: { status: true },
    }),
  ]);

  if (!market) {
    return apiError("That market no longer exists.", 404, "MARKET_NOT_FOUND");
  }
  if (market.status !== "SETTLED" && market.status !== "VOID") {
    return apiError(
      "This market hasn't been settled yet.",
      422,
      "MARKET_NOT_SETTLED",
    );
  }
  if (!position) {
    return apiError(
      "You don't have a position on this market.",
      404,
      "NO_POSITION",
    );
  }
  if (position.status === "CLAIMED") {
    return apiError(
      "You've already claimed your payout for this market.",
      409,
      "ALREADY_CLAIMED",
    );
  }
  if (position.status !== "WON" && position.status !== "VOID") {
    return apiError(
      "This position is not eligible for a claim.",
      422,
      "NOT_ELIGIBLE",
    );
  }
  if (!user.circleWalletId || !user.arcWalletAddress) {
    return apiError(
      "Set up your wallet before claiming.",
      409,
      "WALLET_NOT_SET_UP",
    );
  }

  try {
    const onChainMarketId = toOnChainMarketId(marketId);

    const { userToken, encryptionKey } = await createCircleUserToken(userId);
    const { challengeId } = await createClaimChallenge({
      userId,
      walletId: user.circleWalletId,
      onChainMarketId,
    });

    return apiSuccess({ challengeId, userToken, encryptionKey });
  } catch (error) {
    console.error("Failed to start claim challenge:", error);
    return apiError(
      "Something went wrong starting your claim. Please try again.",
      500,
      "INTERNAL_ERROR",
    );
  }
}
