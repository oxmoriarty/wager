import { getAddress, parseEventLogs, formatUnits } from "viem";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { claimConfirmSchema } from "@/lib/validation/wallet";
import { toOnChainMarketId } from "@/lib/arc/market-id";
import {
  arcTestnet,
  getArcPublicClient,
  getEscrowContractAddress,
} from "@/lib/arc/config";
import { ESCROW_ABI } from "@/lib/arc/abi";
import { findClaimTransactionHash } from "@/lib/circle/client";
import { emitClaimCompleted } from "@/lib/socket/emit";

/**
 * Called by the client after `W3SSdk.execute()` reports a claim challenge
 * completed successfully. Same trust model as `stake-confirm`: nothing
 * from the client is trusted. We locate the tx via Circle, then
 * independently verify the on-chain `Claimed` event before updating
 * Position status and creating a Transaction record.
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

  const parsed = claimConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Invalid request.",
      422,
      "VALIDATION_ERROR",
    );
  }

  const { marketId } = parsed.data;
  const userId = session.user.id;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { circleWalletId: true, arcWalletAddress: true },
  });

  if (!user.circleWalletId || !user.arcWalletAddress) {
    return apiError(
      "Set up your wallet before claiming.",
      409,
      "WALLET_NOT_SET_UP",
    );
  }

  const onChainMarketId = toOnChainMarketId(marketId);

  try {
    const txHash = await findClaimTransactionHash({
      userId,
      walletId: user.circleWalletId,
      onChainMarketId,
    });

    if (!txHash) {
      return apiError(
        "We couldn't find your claim transaction yet — it may still be confirming. Please try again in a moment.",
        409,
        "TRANSACTION_NOT_FOUND",
      );
    }

    const publicClient = getArcPublicClient();
    const receipt = await publicClient.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    if (receipt.status !== "success") {
      return apiError(
        "That claim transaction failed on-chain.",
        422,
        "TRANSACTION_FAILED",
      );
    }
    if (
      getAddress(receipt.to ?? "") !== getAddress(getEscrowContractAddress())
    ) {
      return apiError(
        "Transaction was not sent to Wager's Escrow contract.",
        422,
        "INVALID_TRANSACTION",
      );
    }

    const [claimedEvent] = parseEventLogs({
      abi: ESCROW_ABI,
      eventName: "Claimed",
      logs: receipt.logs,
    });

    const eventMatches =
      claimedEvent &&
      claimedEvent.args.marketId === onChainMarketId &&
      getAddress(claimedEvent.args.staker) ===
        getAddress(user.arcWalletAddress);

    if (!eventMatches) {
      return apiError(
        "This transaction doesn't match the expected claim — nothing was recorded.",
        422,
        "TRANSACTION_MISMATCH",
      );
    }

    // Prevent duplicate recording
    const existing = await prisma.transaction.findFirst({
      where: { arcTxHash: txHash },
      select: { id: true },
    });
    if (existing) {
      return apiError(
        "This claim has already been recorded.",
        409,
        "ALREADY_RECORDED",
      );
    }

    // Convert payout from wei to human-readable USDC string
    const payoutAmount = formatUnits(
      claimedEvent.args.payout,
      arcTestnet.nativeCurrency.decimals,
    );

    await prisma.$transaction(async (tx) => {
      await tx.position.update({
        where: { userId_marketId: { userId, marketId } },
        data: {
          status: "CLAIMED",
          arcClaimTxHash: txHash,
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: "CLAIM",
          status: "CONFIRMED",
          amount: payoutAmount,
          arcTxHash: txHash,
        },
      });
    });

    emitClaimCompleted({
      marketId,
      userId,
      payout: payoutAmount,
    });

    return apiSuccess(
      { marketId, payout: payoutAmount, txHash },
      "Claim recorded.",
      201,
    );
  } catch (error) {
    console.error("Failed to confirm claim:", error);
    return apiError(
      "Something went wrong recording your claim. Please try again.",
      500,
      "INTERNAL_ERROR",
    );
  }
}
