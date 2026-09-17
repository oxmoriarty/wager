import { getAddress, parseEventLogs, parseUnits } from "viem";
import { Prisma } from "@prisma/client";

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
    // Retry finding the transaction from Circle (up to 5 attempts, 1.5s delay)
    let txHash: string | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      txHash = await findStakeTransactionHash({
        userId,
        walletId: user.circleWalletId,
        onChainMarketId,
        sideIndex,
      });
      if (txHash) break;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    if (!txHash) {
      return apiError(
        "We couldn't find your transaction yet — it may still be confirming with Circle. Please try again in a moment.",
        409,
        "TRANSACTION_NOT_FOUND",
      );
    }

    const publicClient = getArcPublicClient();
    let receipt;
    try {
      receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
        timeout: 30_000,
      });
    } catch (receiptErr) {
      console.warn("waitForTransactionReceipt timed out or pending:", receiptErr);
      return apiError(
        "Your transaction has been submitted to Arc Testnet and is still being mined. Please try again in a moment.",
        409,
        "TRANSACTION_PENDING",
      );
    }

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
      stakedEvent.args.marketId.toLowerCase() === onChainMarketId.toLowerCase() &&
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

    const decimalAmount = new Prisma.Decimal(amount);

    const market = await prisma.$transaction(async (tx) => {
      await tx.position.upsert({
        where: { userId_marketId: { userId, marketId } },
        create: {
          userId,
          marketId,
          side,
          amount: decimalAmount,
          arcEscrowTxHash: txHash,
        },
        update: {
          amount: { increment: decimalAmount },
          arcEscrowTxHash: txHash,
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: "ESCROW_LOCK",
          status: "CONFIRMED",
          amount: decimalAmount,
          arcTxHash: txHash,
        },
      });

      return tx.market.update({
        where: { id: marketId },
        data:
          side === "SUPPORT"
            ? { totalSupportAmount: { increment: decimalAmount } }
            : { totalChallengeAmount: { increment: decimalAmount } },
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
    const msg = error instanceof Error ? error.message : String(error);
    return apiError(
      `Failed to record stake: ${msg}`,
      500,
      "INTERNAL_ERROR",
    );
  }
}
