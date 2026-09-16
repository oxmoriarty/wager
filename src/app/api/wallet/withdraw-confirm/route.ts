import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withdrawConfirmSchema } from "@/lib/validation/wallet";
import { findWithdrawTransactionHash } from "@/lib/circle/client";
import { Prisma } from "@prisma/client";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return apiError("You must be signed in.", 401, "UNAUTHENTICATED");
  }

  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400, "BAD_REQUEST");
  }

  const parsed = withdrawConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Invalid confirmation request",
      400,
      "VALIDATION_ERROR",
    );
  }

  const { destinationAddress, amount, txHash: reportedTxHash } = parsed.data;

  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { circleWalletId: true, arcWalletAddress: true },
    });

    if (!user.circleWalletId) {
      return apiError("Wallet not initialized.", 400, "WALLET_NOT_SET_UP");
    }

    let txHash = reportedTxHash ?? null;

    if (!txHash) {
      for (let attempt = 0; attempt < 5; attempt++) {
        txHash = await findWithdrawTransactionHash({
          userId,
          walletId: user.circleWalletId,
          destinationAddress,
        });
        if (txHash) break;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        type: "WITHDRAWAL",
        status: "CONFIRMED",
        amount: new Prisma.Decimal(amount),
        arcTxHash: txHash,
      },
    });

    return apiSuccess({
      transactionId: transaction.id,
      amount,
      txHash,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Failed to confirm withdrawal:", error);
    return apiError(
      err?.message || "Something went wrong recording your withdrawal.",
      500,
      "INTERNAL_ERROR",
    );
  }
}
