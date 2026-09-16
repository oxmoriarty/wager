"use client";

import { useMemo } from "react";
import {
  createTransactionKit,
  type TransactionKit,
} from "@genlayer/transaction-kit";
import { GENLAYER_CHAIN } from "./network";

export type { TransactionKit };

// Ethereum provider interface for browser wallets
export interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

export function getEthereumProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  const anyWindow = window as unknown as { ethereum?: EthereumProvider };
  return anyWindow.ethereum || null;
}

/**
 * Hook providing a TransactionKit instance configured for Studio Next.
 */
export function useTransactionKit(
  address: string | null | undefined,
  customProvider?: EthereumProvider | null,
): TransactionKit | null {
  return useMemo(() => {
    const provider = customProvider ?? getEthereumProvider();

    if (!provider || !address || !address.startsWith("0x")) {
      return null;
    }

    try {
      return createTransactionKit({
        chain: GENLAYER_CHAIN,
        provider,
        account: address as `0x${string}`,
      });
    } catch (err) {
      console.error("Failed to initialize TransactionKit:", err);
      return null;
    }
  }, [address, customProvider]);
}
