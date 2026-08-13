import {
  Blockchain,
  initiateUserControlledWalletsClient,
} from "@circle-fin/user-controlled-wallets";
import type { CircleUserControlledWalletsClient } from "@circle-fin/user-controlled-wallets";

import { getEscrowContractAddress } from "@/lib/arc/config";
import type { Hex } from "viem";

const globalForCircle = globalThis as unknown as {
  circleClient: CircleUserControlledWalletsClient | undefined;
};

/**
 * Shared Circle User-Controlled Wallets client (PROJECT.md §7 — "embedded,
 * non-custodial... Wager's backend never has unilateral signing authority
 * over user funds"). Every call this module makes either reads data or
 * issues a *challenge* the end user must complete themselves via the
 * client-side Web SDK (`src/lib/circle/web-sdk.ts`) — the backend never
 * holds or submits a user's signature.
 */
export function getCircleClient(): CircleUserControlledWalletsClient {
  if (globalForCircle.circleClient) {
    return globalForCircle.circleClient;
  }

  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "CIRCLE_API_KEY is not set. Required for Circle User-Controlled " +
        "Wallets (wallet provisioning, balance reads, stake challenges).",
    );
  }

  const client = initiateUserControlledWalletsClient({ apiKey });
  globalForCircle.circleClient = client;
  return client;
}

/**
 * Registers a Wager user with Circle, reusing our own `User.id` as
 * Circle's `userId` so no separate id needs to be stored. Idempotent:
 * Circle returns a "user already exists" error on a repeat call for the
 * same `userId`, which is swallowed here — the caller only cares that a
 * Circle user now exists, not whether this specific call created it.
 */
export async function ensureCircleUser(userId: string): Promise<void> {
  try {
    await getCircleClient().createUser({ userId });
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response
      ?.status;
    if (status === 409) {
      return;
    }
    throw error;
  }
}

/**
 * Mints a short-lived user token + encryption key for the client-side Web
 * SDK to authenticate with and complete a challenge. Must be re-issued
 * per session — never stored server-side beyond the request that needs it.
 */
export async function createCircleUserToken(
  userId: string,
): Promise<{ userToken: string; encryptionKey: string }> {
  const result = await getCircleClient().createUserToken({ userId });
  const userToken = result.data?.userToken;
  const encryptionKey = result.data?.encryptionKey;

  if (!userToken || !encryptionKey) {
    throw new Error("Circle did not return a userToken/encryptionKey.");
  }

  return { userToken, encryptionKey };
}

/**
 * Starts (or resumes) PIN + wallet setup for a user on Arc Testnet.
 * Returns a challengeId the client SDK must complete — safe to call again
 * if a user abandoned setup partway through.
 */
export async function createWalletSetupChallenge(
  userId: string,
): Promise<{ challengeId: string }> {
  const result = await getCircleClient().createUserPinWithWallets({
    userId,
    blockchains: [Blockchain.ArcTestnet],
  });

  const challengeId = result.data?.challengeId;
  if (!challengeId) {
    throw new Error("Circle did not return a challengeId for wallet setup.");
  }

  return { challengeId };
}

/** The user's Arc Testnet wallet, if they've completed setup. */
export async function getArcWallet(
  userId: string,
): Promise<{ walletId: string; address: string } | null> {
  const result = await getCircleClient().listWallets({
    userId,
    blockchain: Blockchain.ArcTestnet,
  });

  const wallet = result.data?.wallets?.[0];
  if (!wallet) return null;

  return { walletId: wallet.id, address: wallet.address };
}

/**
 * Starts a challenge to call `Escrow.stake(marketId, side)` with the
 * stake amount as native value. `amount` is a human-readable decimal
 * string in USDC (e.g. `"10.50"`) — Circle's contract-execution API takes
 * native-token amounts this way, not raw wei, matching the same
 * human-unit convention used throughout Wager's own Decimal fields.
 */
export async function createStakeChallenge(params: {
  userId: string;
  walletId: string;
  onChainMarketId: Hex;
  sideIndex: 0 | 1;
  amount: string;
}): Promise<{ challengeId: string }> {
  const result =
    await getCircleClient().createUserTransactionContractExecutionChallenge({
      userId: params.userId,
      walletId: params.walletId,
      contractAddress: getEscrowContractAddress(),
      abiFunctionSignature: "stake(bytes32,uint8)",
      abiParameters: [params.onChainMarketId, params.sideIndex],
      amount: params.amount,
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

  const challengeId = result.data?.challengeId;
  if (!challengeId) {
    throw new Error(
      "Circle did not return a challengeId for the stake transaction.",
    );
  }

  return { challengeId };
}

/**
 * Locates the transaction hash for a stake the user just completed via
 * the client-side challenge. Circle's Web SDK `execute()` callback
 * reports challenge *status*, not a chain-level tx hash directly — so
 * once the client tells us the challenge succeeded, we ask Circle for
 * that wallet's most recent transactions against the Escrow contract and
 * find the one whose decoded `abiParameters` match this exact stake.
 *
 * This is only used to *locate* a hash quickly. It is never trusted on
 * its own — the caller (`stake-confirm` route) independently re-verifies
 * the resulting hash's on-chain receipt via `getArcPublicClient` before
 * writing anything to Postgres. See that route for the actual trust
 * boundary.
 */
export async function findStakeTransactionHash(params: {
  userId: string;
  walletId: string;
  onChainMarketId: Hex;
  sideIndex: 0 | 1;
}): Promise<string | null> {
  const result = await getCircleClient().listTransactions({
    userId: params.userId,
    walletIds: [params.walletId],
    destinationAddress: getEscrowContractAddress(),
    order: "DESC",
  });

  const transactions = result.data?.transactions ?? [];

  for (const tx of transactions) {
    if (!tx.txHash) continue;
    if (tx.state !== "CONFIRMED" && tx.state !== "COMPLETE") continue;
    if (tx.abiFunctionSignature !== "stake(bytes32,uint8)") continue;

    const [marketIdParam, sideParam] = tx.abiParameters ?? [];
    const matchesMarket =
      typeof marketIdParam === "string" &&
      marketIdParam.toLowerCase() === params.onChainMarketId.toLowerCase();
    const matchesSide = String(sideParam) === String(params.sideIndex);

    if (matchesMarket && matchesSide) {
      return tx.txHash;
    }
  }

  return null;
}
