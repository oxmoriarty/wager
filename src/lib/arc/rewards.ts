/**
 * On-chain read helpers for the Rewards contract.
 *
 * Rewards is a write-once append ledger — only Escrow calls `recordClaim`
 * during `claim()`. These helpers are pure reads (no gas, no signing key).
 *
 * Primary use: admin reconciliation, debugging, future verification.
 * The UI reads from the DB (which is updated atomically in claim-confirm),
 * not from these helpers — see `src/lib/queries/wallet.ts` and
 * `src/lib/queries/profile.ts` for the UI-facing queries.
 */
import type { Address, Hex } from "viem";

import { getArcPublicClient, getRewardsContractAddress } from "@/lib/arc/config";
import { REWARDS_ABI } from "@/lib/arc/abi";

export interface ClaimRecord {
  amount: bigint;
  timestamp: bigint;
  recorded: boolean;
}

/**
 * Fetches the full claim record for a (market, staker) pair from the
 * on-chain Rewards contract. Returns `{ amount, timestamp, recorded }`.
 * If no claim has been recorded, `recorded` will be `false`.
 */
export async function getClaimRecord(
  marketId: Hex,
  stakerAddress: Address,
): Promise<ClaimRecord> {
  const publicClient = getArcPublicClient();
  const rewardsAddress = getRewardsContractAddress();

  const result = await publicClient.readContract({
    address: rewardsAddress,
    abi: REWARDS_ABI,
    functionName: "getClaim",
    args: [marketId, stakerAddress],
  });

  return {
    amount: result.amount,
    timestamp: result.timestamp,
    recorded: result.recorded,
  };
}

/**
 * Quick boolean check: has this (market, staker) pair claimed on-chain?
 */
export async function hasClaimedOnChain(
  marketId: Hex,
  stakerAddress: Address,
): Promise<boolean> {
  const publicClient = getArcPublicClient();
  const rewardsAddress = getRewardsContractAddress();

  return publicClient.readContract({
    address: rewardsAddress,
    abi: REWARDS_ABI,
    functionName: "hasClaimed",
    args: [marketId, stakerAddress],
  });
}

/**
 * Cumulative payout recorded for a staker across all markets.
 * Useful for admin reconciliation against DB totals.
 */
export async function getStakerTotalPayout(
  stakerAddress: Address,
): Promise<bigint> {
  const publicClient = getArcPublicClient();
  const rewardsAddress = getRewardsContractAddress();

  return publicClient.readContract({
    address: rewardsAddress,
    abi: REWARDS_ABI,
    functionName: "stakerTotalPayout",
    args: [stakerAddress],
  });
}

/**
 * Cumulative payout recorded for a market across all stakers.
 * Useful for market summary analytics.
 */
export async function getMarketTotalPayout(
  marketId: Hex,
): Promise<bigint> {
  const publicClient = getArcPublicClient();
  const rewardsAddress = getRewardsContractAddress();

  return publicClient.readContract({
    address: rewardsAddress,
    abi: REWARDS_ABI,
    functionName: "marketTotalPayout",
    args: [marketId],
  });
}
