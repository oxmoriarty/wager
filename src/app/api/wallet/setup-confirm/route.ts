import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getArcWallet } from "@/lib/circle/client";

/**
 * Called by the client immediately after `W3SSdk.execute()` reports the
 * wallet-setup challenge (`POST /api/wallet/init`'s `challengeId`)
 * completed successfully. Looks the resulting wallet up via Circle
 * (rather than trusting anything the client reports) and persists its id
 * + onchain address onto the user's row.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return apiError("You must be signed in.", 401, "UNAUTHENTICATED");
  }

  const userId = session.user.id;

  try {
    const wallet = await getArcWallet(userId);
    if (!wallet) {
      return apiError(
        "No Arc wallet found yet — wallet creation may still be processing. Please try again in a moment.",
        409,
        "WALLET_NOT_READY",
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        circleWalletId: wallet.walletId,
        arcWalletAddress: wallet.address,
      },
    });

    return apiSuccess({ arcWalletAddress: wallet.address });
  } catch (error) {
    console.error("Failed to confirm wallet setup:", error);
    return apiError(
      "Something went wrong confirming your wallet. Please try again.",
      500,
      "INTERNAL_ERROR",
    );
  }
}
