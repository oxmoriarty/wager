// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice The subset of `Rewards` that `Escrow` needs to call.
interface IRewards {
    /// @notice Records a successful claim payout on-chain.
    /// @param marketId  The canonical on-chain market id (`keccak256(utf8(Prisma Market.id))`).
    /// @param staker    The address that received the payout.
    /// @param amount    Payout in native USDC wei (18 decimals — same unit as `msg.value`).
    function recordClaim(bytes32 marketId, address staker, uint256 amount) external;
}
