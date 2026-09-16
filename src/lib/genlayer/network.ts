import { studioDevnet } from "genlayer-js/chains";

/**
 * Studio Next configuration for GenLayer Agent Tank Hackathon (Consensus v0.6).
 * Chain ID: 61997
 * RPC: https://studio-next.genlayer.com/api
 * Explorer: https://explorer-studio-dev.genlayer.com/
 */
const DEFAULT_RPC_URL = "https://studio-next.genlayer.com/api";
const DEFAULT_CHAIN_NAME = "GenLayer Studio Next";
const DEFAULT_CHAIN_ID = 61997;
const DEFAULT_EXPLORER_URL = "https://explorer-studio-dev.genlayer.com";

export interface GenLayerNetworkOverrides {
  chainId?: string | number;
  chainName?: string;
  rpcUrl?: string;
  symbol?: string;
  explorerUrl?: string;
}

function parseChainId(value: string | number | undefined): number {
  if (value === undefined || value === "") {
    return DEFAULT_CHAIN_ID;
  }

  const chainId = Number(value);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new Error(
      `GENLAYER_CHAIN_ID must be a positive integer; received ${value}`,
    );
  }

  return chainId;
}

/**
 * Resolve one network definition shared across server sync jobs, genlayer-js,
 * and Transaction Kit.
 */
export function createGenLayerNetworkConfig(
  overrides: GenLayerNetworkOverrides = {},
) {
  const chainId = parseChainId(overrides.chainId);
  const chainName = overrides.chainName || DEFAULT_CHAIN_NAME;
  const rpcUrl = overrides.rpcUrl || DEFAULT_RPC_URL;
  const symbol = overrides.symbol || "GEN";
  const explorerUrl = overrides.explorerUrl || DEFAULT_EXPLORER_URL;

  const chain = {
    ...studioDevnet,
    id: chainId,
    name: chainName,
    nativeCurrency: {
      name: symbol,
      symbol,
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [rpcUrl],
      },
    },
    blockExplorers: {
      default: {
        name: "GenLayer Studio Next Explorer",
        url: explorerUrl,
      },
    },
  } satisfies typeof studioDevnet;

  return {
    chain,
    wallet: {
      chainId: `0x${chainId.toString(16).toUpperCase()}`,
      chainName,
      nativeCurrency: chain.nativeCurrency,
      rpcUrls: [rpcUrl],
      blockExplorerUrls: [explorerUrl],
    },
  };
}

const networkConfig = createGenLayerNetworkConfig({
  chainId:
    process.env.GENLAYER_CHAIN_ID ||
    process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID,
  chainName:
    process.env.GENLAYER_CHAIN_NAME ||
    process.env.NEXT_PUBLIC_GENLAYER_CHAIN_NAME,
  rpcUrl:
    process.env.GENLAYER_RPC_URL ||
    process.env.NEXT_PUBLIC_GENLAYER_RPC_URL,
  symbol: process.env.NEXT_PUBLIC_GENLAYER_SYMBOL,
  explorerUrl:
    process.env.GENLAYER_EXPLORER_URL ||
    process.env.NEXT_PUBLIC_GENLAYER_EXPLORER_URL,
});

export const GENLAYER_CHAIN = networkConfig.chain;
export const GENLAYER_NETWORK = networkConfig.wallet;
export const GENLAYER_CHAIN_ID = GENLAYER_CHAIN.id;
export const GENLAYER_CHAIN_ID_HEX = GENLAYER_NETWORK.chainId;
export const GENLAYER_EXPLORER_URL = DEFAULT_EXPLORER_URL;
