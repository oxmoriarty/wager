// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Market} from "../src/Market.sol";
import {Escrow} from "../src/Escrow.sol";
import {Rewards} from "../src/Rewards.sol";
import {Side} from "../src/Types.sol";

contract RewardsTest is Test {
    Market internal market;
    Escrow internal escrow;
    Rewards internal rewards;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant MARKET_ID = keccak256("market-1");
    bytes32 internal constant MARKET_ID_2 = keccak256("market-2");

    function setUp() public {
        vm.startPrank(owner);
        market = new Market(owner);
        escrow = new Escrow(owner, address(market));
        rewards = new Rewards(owner);

        market.setEscrow(address(escrow));
        escrow.setRewards(address(rewards));
        rewards.setEscrow(address(escrow));

        market.registerMarket(MARKET_ID);
        market.registerMarket(MARKET_ID_2);
        vm.stopPrank();

        vm.deal(alice, 1000 ether);
        vm.deal(bob, 1000 ether);
        vm.deal(carol, 1000 ether);
    }

    // -----------------------------------------------------------------------
    // setEscrow()
    // -----------------------------------------------------------------------

    function test_setEscrow_onlyOwner() public {
        Rewards fresh = new Rewards(owner);

        vm.prank(stranger);
        vm.expectRevert();
        fresh.setEscrow(address(escrow));

        vm.prank(owner);
        fresh.setEscrow(address(escrow));
        assertEq(fresh.escrow(), address(escrow));
    }

    function test_setEscrow_cannotBeSetTwice() public {
        // rewards already has escrow set in setUp
        vm.prank(owner);
        vm.expectRevert(Rewards.EscrowAlreadySet.selector);
        rewards.setEscrow(makeAddr("other-escrow"));
    }

    // -----------------------------------------------------------------------
    // recordClaim() — access control
    // -----------------------------------------------------------------------

    function test_recordClaim_onlyEscrow() public {
        vm.prank(stranger);
        vm.expectRevert(Rewards.NotEscrow.selector);
        rewards.recordClaim(MARKET_ID, alice, 100 ether);
    }

    function test_recordClaim_ownerCannotCallDirectly() public {
        vm.prank(owner);
        vm.expectRevert(Rewards.NotEscrow.selector);
        rewards.recordClaim(MARKET_ID, alice, 100 ether);
    }

    // -----------------------------------------------------------------------
    // recordClaim() — happy path (via Escrow.claim integration)
    // -----------------------------------------------------------------------

    function test_recordClaim_singleClaim_storedCorrectly() public {
        vm.prank(alice);
        escrow.stake{value: 100 ether}(MARKET_ID, Side.Support);
        vm.prank(bob);
        escrow.stake{value: 40 ether}(MARKET_ID, Side.Challenge);

        vm.prank(owner);
        escrow.settleMarket(MARKET_ID, Side.Support);

        // Alice's pari-mutuel payout: 100 + 100*40/100 = 140 ether
        uint256 expectedPayout = 140 ether;

        vm.warp(1_000_000); // deterministic timestamp
        vm.prank(alice);
        escrow.claim(MARKET_ID);

        Rewards.ClaimRecord memory record = rewards.getClaim(MARKET_ID, alice);
        assertTrue(record.recorded, "should be recorded");
        assertEq(record.amount, expectedPayout, "payout amount mismatch");
        assertEq(record.timestamp, 1_000_000, "timestamp mismatch");
    }

    function test_recordClaim_voidRefund_storedCorrectly() public {
        vm.prank(alice);
        escrow.stake{value: 50 ether}(MARKET_ID, Side.Support);

        vm.prank(owner);
        escrow.voidMarket(MARKET_ID);

        vm.prank(alice);
        escrow.claim(MARKET_ID);

        Rewards.ClaimRecord memory record = rewards.getClaim(MARKET_ID, alice);
        assertTrue(record.recorded, "void refund should be recorded");
        assertEq(record.amount, 50 ether, "refund amount mismatch");
    }

    // -----------------------------------------------------------------------
    // Duplicate guard
    // -----------------------------------------------------------------------

    function test_recordClaim_revertsOnDuplicate() public {
        // The only way to trigger a duplicate in production is by having
        // Escrow call recordClaim twice for the same (market, staker).
        // Escrow's own AlreadyClaimed guard prevents that — so we call
        // recordClaim directly from the escrow address here.
        vm.startPrank(address(escrow));
        rewards.recordClaim(MARKET_ID, alice, 100 ether);

        vm.expectRevert(
            abi.encodeWithSelector(Rewards.AlreadyRecorded.selector, MARKET_ID, alice)
        );
        rewards.recordClaim(MARKET_ID, alice, 100 ether);
        vm.stopPrank();
    }

    // -----------------------------------------------------------------------
    // Aggregate totals
    // -----------------------------------------------------------------------

    function test_marketTotalPayout_accumulatesAcrossWinners() public {
        // Alice 100 Support, Bob 150 Support, Carol 50 Challenge.
        // Support wins. Pool = 300; losing = 50.
        // Alice payout: 100 + 100*50/250 = 120
        // Bob payout:   150 + 150*50/250 = 180
        // Total market payout = 300 (full pool conservation)
        vm.prank(alice);
        escrow.stake{value: 100 ether}(MARKET_ID, Side.Support);
        vm.prank(bob);
        escrow.stake{value: 150 ether}(MARKET_ID, Side.Support);
        vm.prank(carol);
        escrow.stake{value: 50 ether}(MARKET_ID, Side.Challenge);

        vm.prank(owner);
        escrow.settleMarket(MARKET_ID, Side.Support);

        vm.prank(alice);
        escrow.claim(MARKET_ID);
        vm.prank(bob);
        escrow.claim(MARKET_ID);

        assertEq(rewards.marketTotalPayout(MARKET_ID), 300 ether, "market total mismatch");
    }

    function test_stakerTotalPayout_accumulatesAcrossMarkets() public {
        // Alice wins on market 1 and gets a void refund on market 2.
        vm.prank(alice);
        escrow.stake{value: 100 ether}(MARKET_ID, Side.Support);
        vm.prank(bob);
        escrow.stake{value: 50 ether}(MARKET_ID, Side.Challenge);

        vm.prank(alice);
        escrow.stake{value: 30 ether}(MARKET_ID_2, Side.Challenge);

        vm.startPrank(owner);
        escrow.settleMarket(MARKET_ID, Side.Support);  // Alice wins market 1
        escrow.voidMarket(MARKET_ID_2);               // market 2 voided
        vm.stopPrank();

        vm.prank(alice);
        escrow.claim(MARKET_ID);   // payout: 100 + 100*50/100 = 150
        vm.prank(alice);
        escrow.claim(MARKET_ID_2); // refund: 30

        assertEq(
            rewards.stakerTotalPayout(alice),
            180 ether,
            "staker total should be 150 + 30"
        );
    }

    // -----------------------------------------------------------------------
    // View helpers
    // -----------------------------------------------------------------------

    function test_hasClaimed_falseBeforeClaim() public view {
        assertFalse(rewards.hasClaimed(MARKET_ID, alice));
    }

    function test_hasClaimed_trueAfterClaim() public {
        vm.prank(alice);
        escrow.stake{value: 100 ether}(MARKET_ID, Side.Support);
        vm.prank(owner);
        escrow.voidMarket(MARKET_ID);
        vm.prank(alice);
        escrow.claim(MARKET_ID);

        assertTrue(rewards.hasClaimed(MARKET_ID, alice));
    }

    function test_getClaim_returnsUnrecordedForUnknown() public view {
        Rewards.ClaimRecord memory record = rewards.getClaim(MARKET_ID, stranger);
        assertFalse(record.recorded);
        assertEq(record.amount, 0);
        assertEq(record.timestamp, 0);
    }

    // -----------------------------------------------------------------------
    // Escrow backward-compatibility: claim works when Rewards not set
    // -----------------------------------------------------------------------

    function test_claim_succeedsWhenRewardsNotSet() public {
        // Deploy a fresh Escrow without wiring Rewards.
        vm.startPrank(owner);
        Market freshMarket = new Market(owner);
        Escrow freshEscrow = new Escrow(owner, address(freshMarket));
        freshMarket.setEscrow(address(freshEscrow));
        freshMarket.registerMarket(MARKET_ID);
        // Note: freshEscrow.setRewards is NOT called
        vm.stopPrank();

        vm.deal(alice, 100 ether);
        vm.prank(alice);
        freshEscrow.stake{value: 100 ether}(MARKET_ID, Side.Support);
        vm.prank(owner);
        freshEscrow.settleMarket(MARKET_ID, Side.Support);

        uint256 balanceBefore = alice.balance;
        vm.prank(alice);
        freshEscrow.claim(MARKET_ID);

        // Claim should succeed and pay out even without Rewards set
        assertEq(alice.balance - balanceBefore, 100 ether);
    }

    // -----------------------------------------------------------------------
    // Escrow: setRewards access control
    // -----------------------------------------------------------------------

    function test_setRewards_onlyOwner() public {
        Escrow freshEscrow = new Escrow(owner, address(market));

        vm.prank(stranger);
        vm.expectRevert();
        freshEscrow.setRewards(address(rewards));

        vm.prank(owner);
        freshEscrow.setRewards(address(rewards));
        assertEq(address(freshEscrow.rewards()), address(rewards));
    }

    function test_setRewards_cannotBeSetTwice() public {
        // escrow already has rewards set in setUp
        vm.prank(owner);
        vm.expectRevert(Escrow.RewardsAlreadySet.selector);
        escrow.setRewards(makeAddr("other-rewards"));
    }

    // -----------------------------------------------------------------------
    // ClaimRecorded event
    // -----------------------------------------------------------------------

    function test_claimRecorded_eventEmitted() public {
        vm.prank(alice);
        escrow.stake{value: 80 ether}(MARKET_ID, Side.Support);
        vm.prank(owner);
        escrow.voidMarket(MARKET_ID);

        vm.warp(999);
        vm.expectEmit(true, true, false, true, address(rewards));
        emit Rewards.ClaimRecorded(MARKET_ID, alice, 80 ether, 999);

        vm.prank(alice);
        escrow.claim(MARKET_ID);
    }
}
