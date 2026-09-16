import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withdrawChallengeSchema } from "@/lib/validation/wallet";
import {
  createCircleUserToken,
  createWithdrawChallenge,
} from "@/lib/circle/client";
import { getArcPublicClient, arcTestnet } from "@/lib/arc/config";
import { formatUnits } from "viem";

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

  const parsed = withdrawChallengeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Invalid withdrawal request",
      400,
      "VALIDATION_ERROR",
    );
  }

  const { destinationAddress, amount } = parsed.data;

  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { circleWalletId: true, arcWalletAddress: true },
    });

    if (!user.circleWalletId || !user.arcWalletAddress) {
      return apiError(
        "Set up your wallet before withdrawing funds.",
        409,
        "WALLET_NOT_SET_UP",
      );
    }

    if (user.arcWalletAddress.toLowerCase() === destinationAddress.toLowerCase()) {
      return apiError(
        "Destination address must be different from your Arc wallet address.",
        400,
        "SAME_ADDRESS",
      );
    }

    // Verify user has sufficient balance on-chain
    const balanceWei = await getArcPublicClient().getBalance({
      address: user.arcWalletAddress as `0x${string}`,
    });
    const balance = Number(
      formatUnits(balanceWei, arcTestnet.nativeCurrency.decimals),
    );

    if (Number(amount) > balance) {
      return apiError(
        `Insufficient balance. You have ${balance.toFixed(4)} USDC available.`,
        400,
        "INSUFFICIENT_FUNDS",
      );
    }

    const { userToken, encryptionKey } = await createCircleUserToken(userId);
    const { challengeId } = await createWithdrawChallenge({
      userId,
      walletId: user.circleWalletId,
      destinationAddress,
      amount,
    });

    return apiSuccess({ challengeId, userToken, encryptionKey });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Failed to start withdrawal challenge:", error);
    return apiError(
      err?.message || "Something went wrong starting your withdrawal.",
      500,
      "INTERNAL_ERROR",
    );
  }
}
