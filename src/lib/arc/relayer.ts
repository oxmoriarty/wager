import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex, WalletClient } from "viem";

import {
  arcTestnet,
  getArcPublicClient,
  getMarketContractAddress,
  getEscrowContractAddress,
} from "@/lib/arc/config";

const MARKET_ABI = [
  {
    type: "function",
    name: "registerMarket",
    stateMutability: "nonpayable",
    inputs: [{ name: "marketId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "error",
    name: "MarketAlreadyRegistered",
    inputs: [{ name: "marketId", type: "bytes32" }],
  },
] as const;

const ESCROW_SETTLE_ABI = [
  {
    type: "function",
    name: "settleMarket",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "winningSide", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "voidMarket",
    stateMutability: "nonpayable",
    inputs: [{ name: "marketId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "error",
    name: "MarketAlreadyClosed",
    inputs: [{ name: "marketId", type: "bytes32" }],
  },
] as const;

const globalForArcRelayer = globalThis as unknown as {
  arcWalletClient: WalletClient | undefined;
};

/**
 * The backend's own signing key on Arc — PROJECT.md §7's "Settlement
 * relayer: A backend-held operator key, authorized on the Escrow/Market
 * contracts". This key only ever calls owner-gated admin functions
 * (`registerMarket` today; `settleMarket`/`voidMarket` once Settlement
 * exists). It never signs a stake or claim on a user's behalf — those are
 * signed client-side via the user's own Circle wallet
 * (`src/lib/circle/web-sdk.ts`), per §7's non-custodial wallet decision.
 */
function getArcWalletClient(): WalletClient {
  if (globalForArcRelayer.arcWalletClient) {
    return globalForArcRelayer.arcWalletClient;
  }

  const privateKey = process.env.ARC_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "ARC_PRIVATE_KEY is not set. Required to register canonical " +
        "markets on the Market contract (see arc/README.md).",
    );
  }

  const account = privateKeyToAccount(privateKey as Hex);
  const client = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  globalForArcRelayer.arcWalletClient = client;
  return client;
}

/**
 * Registers a canonical market on-chain if it isn't already. Called
 * lazily on a market's first stake attempt rather than eagerly at market
 * creation time, so markets that never receive a stake never cost gas.
 * Safe to call repeatedly — a duplicate registration is a no-op here
 * (the contract's own `MarketAlreadyRegistered` revert is treated as
 * success, not an error).
 */
export async function ensureMarketRegisteredOnChain(
  onChainMarketId: Hex,
): Promise<void> {
  const publicClient = getArcPublicClient();
  const walletClient = getArcWalletClient();
  const marketAddress = getMarketContractAddress();

  try {
    await publicClient.simulateContract({
      account: walletClient.account,
      address: marketAddress,
      abi: MARKET_ABI,
      functionName: "registerMarket",
      args: [onChainMarketId],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("MarketAlreadyRegistered")) {
      return;
    }
    throw error;
  }

  const hash = await walletClient.writeContract({
    account: walletClient.account!,
    chain: arcTestnet,
    address: marketAddress,
    abi: MARKET_ABI,
    functionName: "registerMarket",
    args: [onChainMarketId],
  });

  await publicClient.waitForTransactionReceipt({ hash });
}

/**
 * Settles a market on-chain by calling Escrow.settleMarket.
 * Handles MarketAlreadyClosed gracefully, treating it as success.
 */
export async function settleMarketOnChain(
  onChainMarketId: Hex,
  winningSide: number,
): Promise<void> {
  const publicClient = getArcPublicClient();
  const walletClient = getArcWalletClient();
  const escrowAddress = getEscrowContractAddress();

  try {
    await publicClient.simulateContract({
      account: walletClient.account,
      address: escrowAddress,
      abi: ESCROW_SETTLE_ABI,
      functionName: "settleMarket",
      args: [onChainMarketId, winningSide],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("MarketAlreadyClosed")) {
      return;
    }
    throw error;
  }

  const hash = await walletClient.writeContract({
    account: walletClient.account!,
    chain: arcTestnet,
    address: escrowAddress,
    abi: ESCROW_SETTLE_ABI,
    functionName: "settleMarket",
    args: [onChainMarketId, winningSide],
  });

  await publicClient.waitForTransactionReceipt({ hash });
}

/**
 * Voids a market on-chain by calling Escrow.voidMarket.
 * Handles MarketAlreadyClosed gracefully, treating it as success.
 */
export async function voidMarketOnChain(onChainMarketId: Hex): Promise<void> {
  const publicClient = getArcPublicClient();
  const walletClient = getArcWalletClient();
  const escrowAddress = getEscrowContractAddress();

  try {
    await publicClient.simulateContract({
      account: walletClient.account,
      address: escrowAddress,
      abi: ESCROW_SETTLE_ABI,
      functionName: "voidMarket",
      args: [onChainMarketId],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("MarketAlreadyClosed")) {
      return;
    }
    throw error;
  }

  const hash = await walletClient.writeContract({
    account: walletClient.account!,
    chain: arcTestnet,
    address: escrowAddress,
    abi: ESCROW_SETTLE_ABI,
    functionName: "voidMarket",
    args: [onChainMarketId],
  });

  await publicClient.waitForTransactionReceipt({ hash });
}
