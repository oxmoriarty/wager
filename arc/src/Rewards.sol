// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IRewards} from "./IRewards.sol";

/// @title Rewards
/// @notice Immutable on-chain payout history ledger for Wager prediction
/// markets (PROJECT.md §7: "Calculate winnings, Process claims, Record
/// payout history").
///
/// This contract does **not** custody or move USDC — that is `Escrow`'s
/// job. `Rewards` is a write-once append ledger: every time `Escrow.claim`
/// pays out a winner or a voided-market refund, it calls
/// `Rewards.recordClaim`, which stores an immutable record of what was
/// paid, to whom, on which market, and when.
///
/// Access model:
/// - The contract owner (backend relayer) sets the paired `Escrow`
///   address once, post-deployment, via `setEscrow`.
/// - Only that `Escrow` address may call `recordClaim`.
/// - Anyone may read: `getClaim`, `hasClaimed`, `marketTotalPayout`,
///   `stakerTotalPayout`.
///
/// Amounts are stored in native USDC wei (18 decimals) — the same unit
/// that `Escrow.claim` uses with `msg.value` / `.call{value: payout}`.
/// See `arc/README.md` §"Why native msg.value, not an ERC-20 approve".
contract Rewards is Ownable, IRewards {
    /// @notice Full record of a single claim.
    struct ClaimRecord {
        /// @dev Native USDC wei (18 decimals) paid out to the staker.
        uint256 amount;
        /// @dev `block.timestamp` at the time recordClaim was called.
        uint256 timestamp;
        /// @dev Existence flag — false means no claim recorded for this pair.
        bool recorded;
    }

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------

    /// @notice The sole address permitted to call `recordClaim`.
    /// Zero until set by `setEscrow`.
    address public escrow;

    /// @notice Full per-(market, staker) claim record.
    /// marketId => staker => ClaimRecord
    mapping(bytes32 => mapping(address => ClaimRecord)) public claims;

    /// @notice Cumulative payout recorded for a market across all stakers.
    /// Useful for settlement analytics and market summaries.
    mapping(bytes32 => uint256) public marketTotalPayout;

    /// @notice Cumulative payout recorded for a staker across all markets.
    /// Useful for profile pages and leaderboards.
    mapping(address => uint256) public stakerTotalPayout;

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    event EscrowSet(address indexed escrow);
    event ClaimRecorded(
        bytes32 indexed marketId,
        address indexed staker,
        uint256 amount,
        uint256 timestamp
    );

    // -----------------------------------------------------------------------
    // Errors
    // -----------------------------------------------------------------------

    error EscrowAlreadySet();
    error NotEscrow();
    error AlreadyRecorded(bytes32 marketId, address staker);

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    constructor(address initialOwner) Ownable(initialOwner) {}

    // -----------------------------------------------------------------------
    // Admin
    // -----------------------------------------------------------------------

    /// @notice One-time wiring of the paired Escrow contract. Owner-only.
    /// Mirrors `Market.setEscrow` — set once after both contracts are
    /// deployed, cannot be changed afterward.
    function setEscrow(address escrowAddress) external onlyOwner {
        if (escrow != address(0)) revert EscrowAlreadySet();
        escrow = escrowAddress;
        emit EscrowSet(escrowAddress);
    }

    // -----------------------------------------------------------------------
    // Core
    // -----------------------------------------------------------------------

    /// @notice Records a successful claim payout. Called by the paired
    /// Escrow after funds have been transferred to the staker. Reverts on
    /// a duplicate `(marketId, staker)` pair — a staker can only claim once
    /// per market (enforced by Escrow too, but defence-in-depth here).
    ///
    /// @param marketId  Canonical on-chain market id
    ///                  (`keccak256(utf8(Prisma Market.id))`).
    /// @param staker    Address that received the payout.
    /// @param amount    Payout in native USDC wei (18 decimals).
    function recordClaim(
        bytes32 marketId,
        address staker,
        uint256 amount
    ) external {
        if (msg.sender != escrow) revert NotEscrow();

        ClaimRecord storage record = claims[marketId][staker];
        if (record.recorded) revert AlreadyRecorded(marketId, staker);

        record.amount = amount;
        record.timestamp = block.timestamp;
        record.recorded = true;

        marketTotalPayout[marketId] += amount;
        stakerTotalPayout[staker] += amount;

        emit ClaimRecorded(marketId, staker, amount, block.timestamp);
    }

    // -----------------------------------------------------------------------
    // View helpers
    // -----------------------------------------------------------------------

    /// @notice Returns the full claim record for a (market, staker) pair.
    function getClaim(bytes32 marketId, address staker)
        external
        view
        returns (ClaimRecord memory)
    {
        return claims[marketId][staker];
    }

    /// @notice Convenience bool: true if a claim has been recorded for this
    /// (market, staker) pair, false otherwise.
    function hasClaimed(bytes32 marketId, address staker)
        external
        view
        returns (bool)
    {
        return claims[marketId][staker].recorded;
    }
}
