import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { stakeChallengeSchema } from "@/lib/validation/wallet";
import { toOnChainMarketId } from "@/lib/arc/market-id";
import { CONTRACT_SIDE } from "@/lib/arc/abi";
import { ensureMarketRegisteredOnChain } from "@/lib/arc/relayer";
import {
  createCircleUserToken,
  createStakeChallenge,
} from "@/lib/circle/client";

/**
 * Starts a Support/Challenge stake. Returns everything the client needs
 * to execute the resulting Circle challenge (`W3SSdk.execute`); the
 * actual Position/Transaction rows are only written once the client
 * reports success and calls `POST /api/wallet/stake-confirm`, which
 * independently re-verifies the transaction on-chain (see that route).
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

  const parsed = stakeChallengeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Invalid stake.",
      422,
      "VALIDATION_ERROR",
    );
  }

  const { marketId, side, amount } = parsed.data;
  const userId = session.user.id;

  const [market, user, existingPosition] = await Promise.all([
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
      select: { side: true },
    }),
  ]);

  if (!market) {
    return apiError("That market no longer exists.", 404, "MARKET_NOT_FOUND");
  }
  if (market.status !== "OPEN") {
    return apiError(
      "This market is no longer open for Support/Challenge.",
      422,
      "MARKET_CLOSED",
    );
  }
  if (!user.circleWalletId || !user.arcWalletAddress) {
    return apiError(
      "Set up your wallet before staking on a market.",
      409,
      "WALLET_NOT_SET_UP",
    );
  }
  if (existingPosition && existingPosition.side !== side) {
    return apiError(
      "You already have an open position on the other side of this market.",
      409,
      "SIDE_MISMATCH",
    );
  }

  try {
    const onChainMarketId = toOnChainMarketId(marketId);

    await ensureMarketRegisteredOnChain(onChainMarketId);

    const { userToken, encryptionKey } = await createCircleUserToken(userId);
    const { challengeId } = await createStakeChallenge({
      userId,
      walletId: user.circleWalletId,
      onChainMarketId,
      sideIndex: CONTRACT_SIDE[side],
      amount,
    });

    return apiSuccess({ challengeId, userToken, encryptionKey });
  } catch (error) {
    console.error("Failed to start stake challenge:", error);
    return apiError(
      "Something went wrong starting your stake. Please try again.",
      500,
      "INTERNAL_ERROR",
    );
  }
}
