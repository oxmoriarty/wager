import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import {
  createCircleUserToken,
  createWalletSetupChallenge,
  ensureCircleUser,
  getArcWallet,
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

    // Check if Circle already has the wallet created (e.g. user finished PIN setup)
    const existingWallet = await getArcWallet(userId);
    if (existingWallet) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          circleWalletId: existingWallet.walletId,
          arcWalletAddress: existingWallet.address,
        },
      });

      return apiSuccess({
        hasWallet: true,
        arcWalletAddress: existingWallet.address,
        userToken,
        encryptionKey,
      });
    }

    let challengeId: string;
    try {
      const challenge = await createWalletSetupChallenge(userId);
      challengeId = challenge.challengeId;
    } catch (setupError) {
      // If setup challenge fails (e.g. user already has PIN/wallet in Circle),
      // re-check for existing wallet before failing.
      const retryWallet = await getArcWallet(userId);
      if (retryWallet) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            circleWalletId: retryWallet.walletId,
            arcWalletAddress: retryWallet.address,
          },
        });
        return apiSuccess({
          hasWallet: true,
          arcWalletAddress: retryWallet.address,
          userToken,
          encryptionKey,
        });
      }
      throw setupError;
    }

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
