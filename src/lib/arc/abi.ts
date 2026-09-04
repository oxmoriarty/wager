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
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "marketId", type: "bytes32", indexed: true },
      { name: "staker", type: "address", indexed: true },
      { name: "payout", type: "uint256", indexed: false },
    ],
  },
  {
    type: "error",
    name: "NoStake",
    inputs: [{ name: "marketId", type: "bytes32" }],
  },
  {
    type: "error",
    name: "AlreadyClaimed",
    inputs: [{ name: "marketId", type: "bytes32" }],
  },
  {
    type: "error",
    name: "MarketNotSettled",
    inputs: [{ name: "marketId", type: "bytes32" }],
  },
  {
    type: "error",
    name: "LosingPosition",
    inputs: [{ name: "marketId", type: "bytes32" }],
  },
] as const;

/** Mirrors `enum Side { Support, Challenge }` in `arc/src/Types.sol`. */
export const CONTRACT_SIDE = {
  SUPPORT: 0,
  CHALLENGE: 1,
} as const;

/**
 * Minimal ABI for the Rewards contract — read-only view functions.
 * Rewards is a write-once append ledger; only Escrow calls `recordClaim`.
 * The backend only needs to *read* from it (admin reconciliation, etc.).
 */
export const REWARDS_ABI = [
  {
    type: "function",
    name: "getClaim",
    stateMutability: "view",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "staker", type: "address" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "amount", type: "uint256" },
          { name: "timestamp", type: "uint256" },
          { name: "recorded", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "hasClaimed",
    stateMutability: "view",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "staker", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "marketTotalPayout",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "stakerTotalPayout",
    stateMutability: "view",
    inputs: [{ name: "staker", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "ClaimRecorded",
    inputs: [
      { name: "marketId", type: "bytes32", indexed: true },
      { name: "staker", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;
