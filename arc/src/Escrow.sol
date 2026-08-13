// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Side} from "./Types.sol";
import {IMarket} from "./IMarket.sol";

/// @title Escrow
/// @notice Custodies USDC staked on Wager prediction markets and pays it
/// back out per PROJECT.md §7 ("Lock USDC, unlock after settlement,
/// prevent double claims").
///
/// Arc's native gas token *is* USDC (see docs.arc.io "EVM differences" —
/// native balance uses 18 decimals; the ERC-20 interface at a fixed
/// precompile address is the same underlying balance at 6 decimals). This
/// contract deliberately stakes via native `msg.value` rather than an
/// ERC-20 `transferFrom`: it is the idiomatic Arc pattern, needs no
/// separate `approve` transaction, and costs roughly a third of the gas
/// (~21k vs ~65k per Arc's own docs).
///
/// Payouts are pari-mutuel per PROJECT.md §7: the losing side's total
/// stake is redistributed to the winning side, proportional to stake. No
/// fixed odds are ever quoted or stored.
///
/// The contract owner (a backend-held operator key, per PROJECT.md §7's
/// "Settlement relayer") can only call `settleMarket` / `voidMarket` — it
/// can never withdraw staked funds itself. There is intentionally no
/// owner-withdraw function anywhere in this contract.
contract Escrow is Ownable, ReentrancyGuard {
    enum MarketState {
        Open,
        Settled,
        Voided
    }

    struct StakeInfo {
        Side side;
        uint256 amount;
        bool set;
        bool claimed;
    }

    struct SettlementInfo {
        MarketState state;
        Side winningSide;
        uint256 finalSupportTotal;
        uint256 finalChallengeTotal;
    }

    IMarket public immutable market;

    /// marketId => staker => their (single-sided) position in this market.
    mapping(bytes32 => mapping(address => StakeInfo)) public stakes;

    /// marketId => settlement outcome. Defaults to `MarketState.Open`.
    mapping(bytes32 => SettlementInfo) public settlements;

    event Staked(bytes32 indexed marketId, address indexed staker, Side side, uint256 amount);
    event MarketSettled(bytes32 indexed marketId, Side winningSide, uint256 finalSupportTotal, uint256 finalChallengeTotal);
    event MarketVoided(bytes32 indexed marketId);
    event Claimed(bytes32 indexed marketId, address indexed staker, uint256 payout);

    error ZeroStake();
    error MarketClosed(bytes32 marketId);
    error MarketAlreadyClosed(bytes32 marketId);
    error MarketHasNoStakes(bytes32 marketId);
    error SideMismatch(bytes32 marketId);
    error NoStake(bytes32 marketId);
    error AlreadyClaimed(bytes32 marketId);
    error MarketNotSettled(bytes32 marketId);
    error LosingPosition(bytes32 marketId);
    error TransferFailed();

    constructor(address initialOwner, address marketAddress) Ownable(initialOwner) {
        market = IMarket(marketAddress);
    }

    /// @notice Stakes native USDC (`msg.value`) on one side of a market.
    /// A staker may only ever hold one side of a given market — a second
    /// call with a different `side` reverts; a second call with the same
    /// `side` tops up the existing position.
    function stake(bytes32 marketId, Side side) external payable {
        if (msg.value == 0) revert ZeroStake();
        if (settlements[marketId].state != MarketState.Open) {
            revert MarketClosed(marketId);
        }

        StakeInfo storage info = stakes[marketId][msg.sender];
        if (info.set && info.side != side) revert SideMismatch(marketId);

        info.side = side;
        info.amount += msg.value;
        info.set = true;

        market.recordStake(marketId, side, msg.value);

        emit Staked(marketId, msg.sender, side, msg.value);
    }

    /// @notice Records the adjudicated winning side and snapshots final
    /// pool totals so `claim` can compute pari-mutuel payouts without
    /// depending on `Market` state remaining unchanged. Owner-only —
    /// called by the backend once a GenLayer Settlement Intelligent
    /// Contract decision has been validated (see PROJECT.md §6).
    function settleMarket(bytes32 marketId, Side winningSide) external onlyOwner {
        SettlementInfo storage settlement = settlements[marketId];
        if (settlement.state != MarketState.Open) revert MarketAlreadyClosed(marketId);

        (uint256 supportTotal, uint256 challengeTotal) = market.getTotals(marketId);
        if (supportTotal == 0 && challengeTotal == 0) revert MarketHasNoStakes(marketId);

        settlement.state = MarketState.Settled;
        settlement.winningSide = winningSide;
        settlement.finalSupportTotal = supportTotal;
        settlement.finalChallengeTotal = challengeTotal;

        emit MarketSettled(marketId, winningSide, supportTotal, challengeTotal);
    }

    /// @notice Marks a market voided (postponed/abandoned match, or a
    /// GenLayer settlement that could not reach a confident decision) —
    /// every staker is entitled to a full refund of their own stake via
    /// `claim`. Owner-only.
    function voidMarket(bytes32 marketId) external onlyOwner {
        SettlementInfo storage settlement = settlements[marketId];
        if (settlement.state != MarketState.Open) revert MarketAlreadyClosed(marketId);
        settlement.state = MarketState.Voided;
        emit MarketVoided(marketId);
    }

    /// @notice Claims a settled or voided position. Reverts if the market
    /// is still open, the caller never staked, they already claimed, or
    /// (for a settled market) they staked the losing side.
    function claim(bytes32 marketId) external nonReentrant {
        StakeInfo storage info = stakes[marketId][msg.sender];
        if (!info.set) revert NoStake(marketId);
        if (info.claimed) revert AlreadyClaimed(marketId);

        SettlementInfo storage settlement = settlements[marketId];
        uint256 payout;

        if (settlement.state == MarketState.Voided) {
            payout = info.amount;
        } else if (settlement.state == MarketState.Settled) {
            if (info.side != settlement.winningSide) revert LosingPosition(marketId);

            (uint256 winningTotal, uint256 losingTotal) = info.side == Side.Support
                ? (settlement.finalSupportTotal, settlement.finalChallengeTotal)
                : (settlement.finalChallengeTotal, settlement.finalSupportTotal);

            // Pari-mutuel: your stake back, plus your proportional share of
            // the losing pool. `winningTotal` is guaranteed >= info.amount
            // > 0 here, since info.amount was counted into it.
            payout = info.amount + (info.amount * losingTotal) / winningTotal;
        } else {
            revert MarketNotSettled(marketId);
        }

        info.claimed = true;

        (bool success,) = msg.sender.call{value: payout}("");
        if (!success) revert TransferFailed();

        emit Claimed(marketId, msg.sender, payout);
    }
}
