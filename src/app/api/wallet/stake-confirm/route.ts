import { getAddress, parseEventLogs, parseUnits } from "viem";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { stakeConfirmSchema } from "@/lib/validation/wallet";
import { toOnChainMarketId } from "@/lib/arc/market-id";
import {
  arcTestnet,
  getArcPublicClient,
  getEscrowContractAddress,
} from "@/lib/arc/config";
import { ESCROW_ABI, CONTRACT_SIDE } from "@/lib/arc/abi";
import { findStakeTransactionHash } from "@/lib/circle/client";
import { emitLiquidityUpdated } from "@/lib/socket/emit";

/**
 * Called by the client after `W3SSdk.execute()` reports a stake
 * challenge (from `POST /api/wallet/stake-challenge`) completed
 * successfully. Nothing here is taken on the client's word: this route
 * locates the resulting transaction via Circle, then independently reads
 * its receipt and decoded `Staked` event straight from Arc RPC and
 * checks every field (contract address, market, staker, side, amount)
 * before writing anything to Postgres. If verification fails for any
 * reason, no Position/Transaction row is created.
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

  const parsed = stakeConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Invalid stake.",
      422,
      "VALIDATION_ERROR",
    );
  }

  const { marketId, side, amount } = parsed.data;
  const userId = session.user.id;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { circleWalletId: true, arcWalletAddress: true },
  });

  if (!user.circleWalletId || !user.arcWalletAddress) {
    return apiError(
      "Set up your wallet before staking on a market.",
      409,
      "WALLET_NOT_SET_UP",
    );
  }

  const onChainMarketId = toOnChainMarketId(marketId);
  const sideIndex = CONTRACT_SIDE[side];

  try {
    const txHash = await findStakeTransactionHash({
      userId,
      walletId: user.circleWalletId,
      onChainMarketId,
      sideIndex,
    });

    if (!txHash) {
      return apiError(
        "We couldn't find your transaction yet — it may still be confirming. Please try again in a moment.",
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
        "That stake transaction failed on-chain.",
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

    const [stakedEvent] = parseEventLogs({
      abi: ESCROW_ABI,
      eventName: "Staked",
      logs: receipt.logs,
    });

    const expectedAmountWei = parseUnits(
      amount,
      arcTestnet.nativeCurrency.decimals,
    );
    const eventMatches =
      stakedEvent &&
      stakedEvent.args.marketId === onChainMarketId &&
      getAddress(stakedEvent.args.staker) ===
        getAddress(user.arcWalletAddress) &&
      Number(stakedEvent.args.side) === sideIndex &&
      stakedEvent.args.amount === expectedAmountWei;

    if (!eventMatches) {
      return apiError(
        "This transaction doesn't match the expected stake — nothing was recorded.",
        422,
        "TRANSACTION_MISMATCH",
      );
    }

    const existing = await prisma.transaction.findFirst({
      where: { arcTxHash: txHash },
      select: { id: true },
    });
    if (existing) {
      return apiError(
        "This stake has already been recorded.",
        409,
        "ALREADY_RECORDED",
      );
    }

    const market = await prisma.$transaction(async (tx) => {
      await tx.position.upsert({
        where: { userId_marketId: { userId, marketId } },
        create: {
          userId,
          marketId,
          side,
          amount,
          arcEscrowTxHash: txHash,
        },
        update: {
          amount: { increment: amount },
          arcEscrowTxHash: txHash,
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: "ESCROW_LOCK",
          status: "CONFIRMED",
          amount,
          arcTxHash: txHash,
        },
      });

      return tx.market.update({
        where: { id: marketId },
        data:
          side === "SUPPORT"
            ? { totalSupportAmount: { increment: amount } }
            : { totalChallengeAmount: { increment: amount } },
        select: {
          id: true,
          totalSupportAmount: true,
          totalChallengeAmount: true,
        },
      });
    });

    emitLiquidityUpdated({
      marketId: market.id,
      totalSupportAmount: market.totalSupportAmount.toString(),
      totalChallengeAmount: market.totalChallengeAmount.toString(),
    });

    return apiSuccess(
      { marketId, side, amount, txHash },
      "Stake recorded.",
      201,
    );
  } catch (error) {
    console.error("Failed to confirm stake:", error);
    return apiError(
      "Something went wrong recording your stake. Please try again.",
      500,
      "INTERNAL_ERROR",
    );
  }
}
