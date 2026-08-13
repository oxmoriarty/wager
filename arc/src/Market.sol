// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Side} from "./Types.sol";

/// @title Market
/// @notice On-chain registry for Wager's canonical prediction markets.
///
/// This contract does not custody funds — it is the pool-accounting ledger
/// PROJECT.md §7 describes ("Register positions, Track market liquidity,
/// Link positions to canonical markets"). `Escrow` is the sole contract
/// authorized to record stakes here, and it does so in the same
/// transaction that pulls the staker's native USDC (see `Escrow.stake`).
///
/// `marketId` is `keccak256(utf8(<Wager Prisma Market.id>))` — see
/// `src/lib/arc/market-id.ts` on the backend for the canonical derivation.
/// The chain never sees Wager's cuid-format Market ids directly.
contract Market is Ownable {
    struct MarketInfo {
        uint256 supportTotal;
        uint256 challengeTotal;
        bool exists;
        bool locked;
    }

    /// @notice The Escrow contract permitted to call `recordStake`.
    /// Set once by the owner after both contracts are deployed.
    address public escrow;

    mapping(bytes32 => MarketInfo) public markets;

    event EscrowSet(address indexed escrow);
    event MarketRegistered(bytes32 indexed marketId);
    event MarketLocked(bytes32 indexed marketId);
    event StakeRecorded(bytes32 indexed marketId, Side indexed side, uint256 amount);

    error EscrowAlreadySet();
    error NotEscrow();
    error MarketAlreadyRegistered(bytes32 marketId);
    error MarketNotRegistered(bytes32 marketId);
    error MarketIsLocked(bytes32 marketId);

    constructor(address initialOwner) Ownable(initialOwner) {}

    modifier onlyEscrow() {
        if (msg.sender != escrow) revert NotEscrow();
        _;
    }

    /// @notice One-time wiring of the paired Escrow contract. Owner-only.
    function setEscrow(address escrowAddress) external onlyOwner {
        if (escrow != address(0)) revert EscrowAlreadySet();
        escrow = escrowAddress;
        emit EscrowSet(escrowAddress);
    }

    /// @notice Registers a canonical market discovered off-chain (GenLayer
    /// Fixture Discovery -> Wager backend). Owner-only (backend relayer).
    function registerMarket(bytes32 marketId) external onlyOwner {
        if (markets[marketId].exists) revert MarketAlreadyRegistered(marketId);
        markets[marketId] = MarketInfo({supportTotal: 0, challengeTotal: 0, exists: true, locked: false});
        emit MarketRegistered(marketId);
    }

    /// @notice Freezes a market so no further stakes can be recorded —
    /// called once a match is live/finished and Support/Challenge should
    /// close. Owner-only.
    function lockMarket(bytes32 marketId) external onlyOwner {
        MarketInfo storage info = markets[marketId];
        if (!info.exists) revert MarketNotRegistered(marketId);
        info.locked = true;
        emit MarketLocked(marketId);
    }

    /// @notice Called by `Escrow` in the same transaction a stake is
    /// accepted, to keep pool totals in sync with custody.
    function recordStake(bytes32 marketId, Side side, uint256 amount) external onlyEscrow {
        MarketInfo storage info = markets[marketId];
        if (!info.exists) revert MarketNotRegistered(marketId);
        if (info.locked) revert MarketIsLocked(marketId);

        if (side == Side.Support) {
            info.supportTotal += amount;
        } else {
            info.challengeTotal += amount;
        }

        emit StakeRecorded(marketId, side, amount);
    }

    function getMarket(bytes32 marketId) external view returns (MarketInfo memory) {
        return markets[marketId];
    }

    /// @notice Lightweight read used by `Escrow` at settlement time to
    /// snapshot final pool totals, without coupling `IMarket` to the full
    /// `MarketInfo` struct type.
    function getTotals(bytes32 marketId) external view returns (uint256 supportTotal, uint256 challengeTotal) {
        MarketInfo storage info = markets[marketId];
        return (info.supportTotal, info.challengeTotal);
    }
}
