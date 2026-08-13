import { auth } from "@/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getWalletOverview } from "@/lib/queries/wallet";

/**
 * Returns the signed-in user's Arc wallet address and live USDC balance.
 * Balance is read directly from Arc RPC (native `getBalance`, 18
 * decimals — Arc's own native currency *is* USDC, see `arc/README.md`),
 * not from Circle's balance API — no extra Circle round-trip needed for
 * a value that's already public on-chain. Shared with the `/wallet` page
 * via `getWalletOverview` rather than duplicated.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return apiError("You must be signed in.", 401, "UNAUTHENTICATED");
  }

  try {
    const overview = await getWalletOverview(session.user.id);
    return apiSuccess(overview);
  } catch (error) {
    console.error("Failed to read Arc wallet balance:", error);
    return apiError(
      "Couldn't reach Arc Testnet to check your balance. Please try again.",
      502,
      "ARC_RPC_ERROR",
    );
  }
}
