import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import {
  createCircleUserToken,
  createWalletSetupChallenge,
  ensureCircleUser,
} from "@/lib/circle/client";

/**
 * Ensures the signed-in user has a Circle account and returns everything
 * the client-side Web SDK needs to complete (or resume) Arc wallet setup.
 * Idempotent — safe to call again if a user abandoned setup partway
 * through, or just to fetch a fresh `userToken` for a later stake
 * challenge (tokens are short-lived and re-minted per session).
 *
 * If the user already has a wallet (`User.arcWalletAddress` set), this
 * still returns a valid `userToken`/`encryptionKey` pair — the client
 * needs a fresh one for every challenge it executes, not just the first.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return apiError("You must be signed in.", 401, "UNAUTHENTICATED");
  }

  const userId = session.user.id;

  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { arcWalletAddress: true },
    });

    await ensureCircleUser(userId);
    const { userToken, encryptionKey } = await createCircleUserToken(userId);

    if (user.arcWalletAddress) {
      return apiSuccess({
        hasWallet: true,
        arcWalletAddress: user.arcWalletAddress,
        userToken,
        encryptionKey,
      });
    }

    const { challengeId } = await createWalletSetupChallenge(userId);

    return apiSuccess({
      hasWallet: false,
      arcWalletAddress: null,
      userToken,
      encryptionKey,
      challengeId,
    });
  } catch (error) {
    console.error("Failed to initialize wallet:", error);
    return apiError(
      "Something went wrong setting up your wallet. Please try again.",
      500,
      "INTERNAL_ERROR",
    );
  }
}
