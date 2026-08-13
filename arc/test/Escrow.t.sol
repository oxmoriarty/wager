// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Market} from "../src/Market.sol";
import {Escrow} from "../src/Escrow.sol";
import {Side} from "../src/Types.sol";

contract EscrowTest is Test {
    Market internal market;
    Escrow internal escrow;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant MARKET_ID = keccak256("market-1");

    function setUp() public {
        vm.startPrank(owner);
        market = new Market(owner);
        escrow = new Escrow(owner, address(market));
        market.setEscrow(address(escrow));
        market.registerMarket(MARKET_ID);
        vm.stopPrank();

        vm.deal(alice, 1000 ether);
        vm.deal(bob, 1000 ether);
        vm.deal(carol, 1000 ether);
    }

    // ---------------------------------------------------------------
    // stake()
    // ---------------------------------------------------------------

    function test_stake_recordsPositionAndForwardsToMarket() public {
        vm.prank(alice);
        escrow.stake{value: 100 ether}(MARKET_ID, Side.Support);

        (Side side, uint256 amount, bool set, bool claimed) = escrow.stakes(MARKET_ID, alice);
        assertEq(uint8(side), uint8(Side.Support));
        assertEq(amount, 100 ether);
        assertTrue(set);
        assertFalse(claimed);

        (uint256 supportTotal,) = market.getTotals(MARKET_ID);
        assertEq(supportTotal, 100 ether);
        assertEq(address(escrow).balance, 100 ether);
    }

    function test_stake_toppingUpSameSideAccumulates() public {
        vm.startPrank(alice);
        escrow.stake{value: 40 ether}(MARKET_ID, Side.Support);
        escrow.stake{value: 60 ether}(MARKET_ID, Side.Support);
        vm.stopPrank();

        (, uint256 amount,,) = escrow.stakes(MARKET_ID, alice);
        assertEq(amount, 100 ether);
    }

    function test_stake_revertsOnSideSwitch() public {
        vm.startPrank(alice);
        escrow.stake{value: 40 ether}(MARKET_ID, Side.Support);

        vm.expectRevert(abi.encodeWithSelector(Escrow.SideMismatch.selector, MARKET_ID));
        escrow.stake{value: 10 ether}(MARKET_ID, Side.Challenge);
        vm.stopPrank();
    }

    function test_stake_revertsOnZeroValue() public {
        vm.prank(alice);
        vm.expectRevert(Escrow.ZeroStake.selector);
        escrow.stake{value: 0}(MARKET_ID, Side.Support);
    }

    function test_stake_revertsAfterSettlement() public {
        vm.prank(alice);
        escrow.stake{value: 10 ether}(MARKET_ID, Side.Support);

        vm.prank(owner);
        escrow.settleMarket(MARKET_ID, Side.Support);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Escrow.MarketClosed.selector, MARKET_ID));
        escrow.stake{value: 10 ether}(MARKET_ID, Side.Challenge);
    }

    function test_stake_revertsAfterVoid() public {
        vm.prank(owner);
        escrow.voidMarket(MARKET_ID);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Escrow.MarketClosed.selector, MARKET_ID));
        escrow.stake{value: 10 ether}(MARKET_ID, Side.Support);
    }

    // ---------------------------------------------------------------
    // settleMarket()
    // ---------------------------------------------------------------

    function test_settleMarket_onlyOwner() public {
        vm.prank(alice);
        escrow.stake{value: 10 ether}(MARKET_ID, Side.Support);

        vm.prank(stranger);
        vm.expectRevert();
        escrow.settleMarket(MARKET_ID, Side.Support);
    }

    function test_settleMarket_revertsIfNoStakes() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Escrow.MarketHasNoStakes.selector, MARKET_ID));
        escrow.settleMarket(MARKET_ID, Side.Support);
    }

    function test_settleMarket_revertsIfAlreadySettled() public {
        vm.prank(alice);
        escrow.stake{value: 10 ether}(MARKET_ID, Side.Support);

        vm.startPrank(owner);
        escrow.settleMarket(MARKET_ID, Side.Support);

        vm.expectRevert(abi.encodeWithSelector(Escrow.MarketAlreadyClosed.selector, MARKET_ID));
        escrow.settleMarket(MARKET_ID, Side.Support);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------
    // claim() — pari-mutuel math
    // ---------------------------------------------------------------

    /// Alice stakes 100 Support, Bob stakes 50 Challenge, Carol stakes 150
    /// Support. Support wins. Pool = 300 total; losing (Challenge) pool =
    /// 50, split proportionally across the 250 winning Support stake:
    ///   Alice: 100 + 100 * 50 / 250 = 120
    ///   Carol: 150 + 150 * 50 / 250 = 180
    /// 120 + 180 = 300 = full pool — no value created or destroyed.
    function test_claim_payoutMathIsExact() public {
        vm.prank(alice);
        escrow.stake{value: 100 ether}(MARKET_ID, Side.Support);
        vm.prank(bob);
        escrow.stake{value: 50 ether}(MARKET_ID, Side.Challenge);
        vm.prank(carol);
        escrow.stake{value: 150 ether}(MARKET_ID, Side.Support);

        vm.prank(owner);
        escrow.settleMarket(MARKET_ID, Side.Support);

        uint256 aliceBefore = alice.balance;
        uint256 carolBefore = carol.balance;

        vm.prank(alice);
        escrow.claim(MARKET_ID);
        vm.prank(carol);
        escrow.claim(MARKET_ID);

        assertEq(alice.balance - aliceBefore, 120 ether);
        assertEq(carol.balance - carolBefore, 180 ether);
        assertEq(address(escrow).balance, 0, "escrow should be fully drained");
    }

    function test_claim_revertsForLosingSide() public {
        vm.prank(alice);
        escrow.stake{value: 100 ether}(MARKET_ID, Side.Support);
        vm.prank(bob);
        escrow.stake{value: 50 ether}(MARKET_ID, Side.Challenge);

        vm.prank(owner);
        escrow.settleMarket(MARKET_ID, Side.Support);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Escrow.LosingPosition.selector, MARKET_ID));
        escrow.claim(MARKET_ID);
    }

    function test_claim_revertsOnDoubleClaim() public {
        vm.prank(alice);
        escrow.stake{value: 100 ether}(MARKET_ID, Side.Support);
        vm.prank(bob);
        escrow.stake{value: 50 ether}(MARKET_ID, Side.Challenge);

        vm.prank(owner);
        escrow.settleMarket(MARKET_ID, Side.Support);

        vm.startPrank(alice);
        escrow.claim(MARKET_ID);

        vm.expectRevert(abi.encodeWithSelector(Escrow.AlreadyClaimed.selector, MARKET_ID));
        escrow.claim(MARKET_ID);
        vm.stopPrank();
    }

    function test_claim_revertsIfCallerNeverStaked() public {
        vm.prank(alice);
        escrow.stake{value: 100 ether}(MARKET_ID, Side.Support);
        vm.prank(bob);
        escrow.stake{value: 50 ether}(MARKET_ID, Side.Challenge);

        vm.prank(owner);
        escrow.settleMarket(MARKET_ID, Side.Support);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Escrow.NoStake.selector, MARKET_ID));
        escrow.claim(MARKET_ID);
    }

    function test_claim_revertsIfMarketStillOpen() public {
        vm.prank(alice);
        escrow.stake{value: 100 ether}(MARKET_ID, Side.Support);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Escrow.MarketNotSettled.selector, MARKET_ID));
        escrow.claim(MARKET_ID);
    }

    // ---------------------------------------------------------------
    // voidMarket() — full refund path
    // ---------------------------------------------------------------

    function test_voidMarket_refundsFullStake() public {
        vm.prank(alice);
        escrow.stake{value: 40 ether}(MARKET_ID, Side.Support);
        vm.prank(bob);
        escrow.stake{value: 15 ether}(MARKET_ID, Side.Challenge);

        vm.prank(owner);
        escrow.voidMarket(MARKET_ID);

        uint256 aliceBefore = alice.balance;
        uint256 bobBefore = bob.balance;

        vm.prank(alice);
        escrow.claim(MARKET_ID);
        vm.prank(bob);
        escrow.claim(MARKET_ID);

        assertEq(alice.balance - aliceBefore, 40 ether);
        assertEq(bob.balance - bobBefore, 15 ether);
        assertEq(address(escrow).balance, 0);
    }

    function test_voidMarket_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        escrow.voidMarket(MARKET_ID);
    }

    function test_voidMarket_revertsIfAlreadySettled() public {
        vm.prank(alice);
        escrow.stake{value: 10 ether}(MARKET_ID, Side.Support);

        vm.startPrank(owner);
        escrow.settleMarket(MARKET_ID, Side.Support);

        vm.expectRevert(abi.encodeWithSelector(Escrow.MarketAlreadyClosed.selector, MARKET_ID));
        escrow.voidMarket(MARKET_ID);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------
    // Reentrancy
    // ---------------------------------------------------------------

    function test_claim_isProtectedAgainstReentrancy() public {
        ReentrantClaimer attacker = new ReentrantClaimer(escrow, MARKET_ID);
        vm.deal(address(attacker), 100 ether);

        attacker.stake{value: 100 ether}();

        vm.prank(bob);
        escrow.stake{value: 50 ether}(MARKET_ID, Side.Challenge);

        vm.prank(owner);
        escrow.settleMarket(MARKET_ID, Side.Support);

        // The attacker's `receive()` tries to re-enter `claim`; OZ's
        // ReentrancyGuard must make the re-entrant call revert, which
        // bubbles up and fails the whole outer call.
        vm.expectRevert();
        attacker.attack();
    }
}

/// @dev Stakes on `Side.Support` and, when it receives its payout,
/// attempts to call `claim` again before the guard is cleared.
contract ReentrantClaimer {
    Escrow internal immutable escrow;
    bytes32 internal immutable marketId;
    bool internal attacking;

    constructor(Escrow _escrow, bytes32 _marketId) {
        escrow = _escrow;
        marketId = _marketId;
    }

    function stake() external payable {
        escrow.stake{value: msg.value}(marketId, Side.Support);
    }

    function attack() external {
        attacking = true;
        escrow.claim(marketId);
    }

    receive() external payable {
        if (attacking) {
            attacking = false;
            escrow.claim(marketId);
        }
    }
}
