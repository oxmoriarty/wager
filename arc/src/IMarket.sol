// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Side} from "./Types.sol";

/// @notice The subset of `Market` that `Escrow` needs to call.
interface IMarket {
    function recordStake(bytes32 marketId, Side side, uint256 amount) external;

    function getTotals(bytes32 marketId) external view returns (uint256 supportTotal, uint256 challengeTotal);
}
