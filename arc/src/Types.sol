// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Which side of a Wager canonical market a stake backs.
/// Mirrors Prisma's `PredictionSide` enum (`SUPPORT` / `CHALLENGE`) —
/// see `src/lib/validation/wallet.ts` on the backend for the mapping.
enum Side {
    Support,
    Challenge
}
