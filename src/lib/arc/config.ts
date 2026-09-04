import { createPublicClient, defineChain, http } from "viem";
import type { Address, PublicClient } from "viem";

/**
 * Arc Testnet — not a built-in viem chain, so defined here from
 * PROJECT.md §7 / docs.arc.io's published network details. USDC is
 * Arc's *native* currency (18 decimals on-chain); see `arc/README.md`
 * for why `Escrow.sol` stakes via native `msg.value` rather than the
 * separate 6-decimal ERC-20 interface.
 *
 * RPC URL and chain id are read from env (`ARC_RPC_URL`/`ARC_CHAIN_ID`,
 * both already reserved in `.env.example`) with the current public Arc
 * Testnet values as defaults, so pointing at a different Arc network
 * later doesn't require a code change.
 */
export const arcTestnet = defineChain({
  id: Number(process.env.ARC_CHAIN_ID ?? 5042002),
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: { name: "Arcscan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

/** Arc's USDC faucet — testnet USDC lands directly in the user's own
 * Circle wallet; Wager has no separate internal deposit flow. */
export const ARC_FAUCET_URL = "https://faucet.circle.com";

const globalForArc = globalThis as unknown as {
  arcPublicClient: PublicClient | undefined;
};

/**
 * Shared read-only Arc RPC client (balance reads, transaction receipt
 * verification). No signing key is needed here — user transactions are
 * signed client-side via Circle's User-Controlled Wallets Web SDK, never
 * by the backend. See `src/lib/circle/client.ts` for the one backend
 * signer that does exist (the settlement/market-registration relayer).
 */
export function getArcPublicClient(): PublicClient {
  if (globalForArc.arcPublicClient) {
    return globalForArc.arcPublicClient;
  }

  const client = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  }) as PublicClient;

  globalForArc.arcPublicClient = client;
  return client;
}

export function getMarketContractAddress(): Address {
  const address = process.env.ARC_MARKET_CONTRACT_ADDRESS;
  if (!address) {
    throw new Error(
      "ARC_MARKET_CONTRACT_ADDRESS is not set. Deploy arc/src/Market.sol " +
        "to Arc Testnet first (see arc/README.md).",
    );
  }
  return address as Address;
}

export function getEscrowContractAddress(): Address {
  const address = process.env.ARC_ESCROW_CONTRACT_ADDRESS;
  if (!address) {
    throw new Error(
      "ARC_ESCROW_CONTRACT_ADDRESS is not set. Deploy arc/src/Escrow.sol " +
        "to Arc Testnet first (see arc/README.md).",
    );
  }
  return address as Address;
}

export function getRewardsContractAddress(): Address {
  const address = process.env.ARC_REWARDS_CONTRACT_ADDRESS;
  if (!address) {
    throw new Error(
      "ARC_REWARDS_CONTRACT_ADDRESS is not set. Deploy arc/src/Rewards.sol " +
        "to Arc Testnet first (see arc/README.md).",
    );
  }
  return address as Address;
}
