/**
 * Minimal ABI fragments — just enough for viem to decode the events the
 * backend needs to verify. The Circle contract-execution challenge that
 * actually *calls* `Escrow.stake` doesn't need a full ABI (Circle takes
 * `abiFunctionSignature: "stake(bytes32,uint8)"` as a plain string — see
 * `src/lib/circle/client.ts`), so this file only carries what's needed
 * for reading, not writing.
 */
export const ESCROW_ABI = [
  {
    type: "event",
    name: "Staked",
    inputs: [
      { name: "marketId", type: "bytes32", indexed: true },
      { name: "staker", type: "address", indexed: true },
      { name: "side", type: "uint8", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
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
    type: "event",
    name: "MarketSettled",
    inputs: [
      { name: "marketId", type: "bytes32", indexed: true },
      { name: "winningSide", type: "uint8", indexed: false },
      { name: "finalSupportTotal", type: "uint256", indexed: false },
      { name: "finalChallengeTotal", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MarketVoided",
    inputs: [{ name: "marketId", type: "bytes32", indexed: true }],
  },
  {
    type: "error",
    name: "MarketAlreadyClosed",
    inputs: [{ name: "marketId", type: "bytes32" }],
  },
  {
    type: "error",
    name: "MarketHasNoStakes",
    inputs: [{ name: "marketId", type: "bytes32" }],
  },
] as const;

/** Mirrors `enum Side { Support, Challenge }` in `arc/src/Types.sol`. */
export const CONTRACT_SIDE = {
  SUPPORT: 0,
  CHALLENGE: 1,
} as const;
