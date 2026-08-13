// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Market} from "../src/Market.sol";
import {Side} from "../src/Types.sol";

contract MarketTest is Test {
    Market internal market;

    address internal owner = makeAddr("owner");
    address internal escrow = makeAddr("escrow");
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant MARKET_ID = keccak256("market-1");

    function setUp() public {
        vm.prank(owner);
        market = new Market(owner);
    }

    function test_setEscrow_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        market.setEscrow(escrow);

        vm.prank(owner);
        market.setEscrow(escrow);
        assertEq(market.escrow(), escrow);
    }

    function test_setEscrow_cannotBeSetTwice() public {
        vm.startPrank(owner);
        market.setEscrow(escrow);

        vm.expectRevert(Market.EscrowAlreadySet.selector);
        market.setEscrow(makeAddr("other-escrow"));
        vm.stopPrank();
    }

    function test_registerMarket_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        market.registerMarket(MARKET_ID);

        vm.prank(owner);
        market.registerMarket(MARKET_ID);

        Market.MarketInfo memory info = market.getMarket(MARKET_ID);
        assertTrue(info.exists);
        assertFalse(info.locked);
        assertEq(info.supportTotal, 0);
        assertEq(info.challengeTotal, 0);
    }

    function test_registerMarket_revertsOnDuplicate() public {
        vm.startPrank(owner);
        market.registerMarket(MARKET_ID);

        vm.expectRevert(abi.encodeWithSelector(Market.MarketAlreadyRegistered.selector, MARKET_ID));
        market.registerMarket(MARKET_ID);
        vm.stopPrank();
    }

    function test_recordStake_onlyCallableByEscrow() public {
        vm.startPrank(owner);
        market.registerMarket(MARKET_ID);
        market.setEscrow(escrow);
        vm.stopPrank();

        vm.prank(stranger);
        vm.expectRevert(Market.NotEscrow.selector);
        market.recordStake(MARKET_ID, Side.Support, 100);

        vm.prank(escrow);
        market.recordStake(MARKET_ID, Side.Support, 100);

        (uint256 supportTotal, uint256 challengeTotal) = market.getTotals(MARKET_ID);
        assertEq(supportTotal, 100);
        assertEq(challengeTotal, 0);
    }

    function test_recordStake_accumulatesBothSides() public {
        vm.startPrank(owner);
        market.registerMarket(MARKET_ID);
        market.setEscrow(escrow);
        vm.stopPrank();

        vm.startPrank(escrow);
        market.recordStake(MARKET_ID, Side.Support, 100);
        market.recordStake(MARKET_ID, Side.Support, 50);
        market.recordStake(MARKET_ID, Side.Challenge, 30);
        vm.stopPrank();

        (uint256 supportTotal, uint256 challengeTotal) = market.getTotals(MARKET_ID);
        assertEq(supportTotal, 150);
        assertEq(challengeTotal, 30);
    }

    function test_recordStake_revertsIfMarketNotRegistered() public {
        vm.prank(owner);
        market.setEscrow(escrow);

        vm.prank(escrow);
        vm.expectRevert(abi.encodeWithSelector(Market.MarketNotRegistered.selector, MARKET_ID));
        market.recordStake(MARKET_ID, Side.Support, 100);
    }

    function test_recordStake_revertsIfLocked() public {
        vm.startPrank(owner);
        market.registerMarket(MARKET_ID);
        market.setEscrow(escrow);
        market.lockMarket(MARKET_ID);
        vm.stopPrank();

        vm.prank(escrow);
        vm.expectRevert(abi.encodeWithSelector(Market.MarketIsLocked.selector, MARKET_ID));
        market.recordStake(MARKET_ID, Side.Support, 100);
    }

    function test_lockMarket_onlyOwner() public {
        vm.prank(owner);
        market.registerMarket(MARKET_ID);

        vm.prank(stranger);
        vm.expectRevert();
        market.lockMarket(MARKET_ID);

        vm.prank(owner);
        market.lockMarket(MARKET_ID);
        assertTrue(market.getMarket(MARKET_ID).locked);
    }

    function test_lockMarket_revertsIfNotRegistered() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Market.MarketNotRegistered.selector, MARKET_ID));
        market.lockMarket(MARKET_ID);
    }
}
