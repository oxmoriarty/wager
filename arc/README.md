# Wager — Arc Smart Contracts

Solidity contracts for Wager's financial execution layer (PROJECT.md
§7). Deployment target: **Arc Testnet**. Built with
[Foundry](https://getfoundry.sh).

## Contracts

| Contract | File             | Status               |
| -------- | ---------------- | --------------------- |
| Market   | `src/Market.sol` | Implemented, tested   |
| Escrow   | `src/Escrow.sol` | Implemented, tested   |
| Rewards  | —                | Not started (deferred to the Settlement Contract phase — see below) |

## Why native `msg.value`, not an ERC-20 `approve`/`transferFrom`

Arc's native gas token **is** USDC — a native transfer and the ERC-20
interface at Arc's fixed USDC precompile address
(`0x3600000000000000000000000000000000000000`) both move the *same*
underlying balance (native side: 18 decimals; ERC-20 side: 6 decimals).
See Arc's own "EVM differences" docs.

`Escrow.stake` therefore accepts USDC as `msg.value` on a `payable`
function rather than pulling funds via `approve` + `transferFrom`.
This is the idiomatic Arc pattern: no separate approval transaction,
and roughly a third of the gas of an ERC-20 transfer (~21k vs ~65k gas,
per Arc's docs).

## Market Contract

Pool-accounting registry — "Register positions, Track market
liquidity, Link positions to canonical markets" per PROJECT.md §7. It
never custodies funds. Only the paired `Escrow` contract (set once,
post-deployment, via `setEscrow`) may call `recordStake`; the contract
owner (Wager's backend relayer key) registers/locks markets.

`marketId` is `keccak256(utf8(<Wager Prisma Market.id>))` — the chain
never sees Wager's cuid-format ids directly. See
`wager/src/lib/arc/market-id.ts` for the derivation, which both the
backend and any future contract call must agree on exactly.

## Escrow Contract

Custodies staked USDC and implements PROJECT.md §7's payout model:

- **Lock** — `stake(marketId, side)` accepts native USDC and forwards
  the pool update to `Market.recordStake` in the same transaction. A
  staker holds one side per market; a second `stake` call with a
  different `side` reverts (top-ups on the same side accumulate).
- **Settle** — `settleMarket(marketId, winningSide)`, owner-only,
  snapshots final pool totals from `Market` so `claim` payouts don't
  depend on `Market` state remaining reachable/unchanged.
- **Void** — `voidMarket(marketId)`, owner-only, for postponed/
  abandoned matches or an inconclusive GenLayer settlement — every
  staker gets a full refund of their own stake via `claim`. This
  implements the "likely full stake return" direction PROJECT.md §7
  flags as not-yet-formally-decided; revisit if that decision changes.
- **Claim** — pari-mutuel payout: `stake + stake * losingPoolTotal /
  winningPoolTotal`. Guarded against reentrancy (OpenZeppelin
  `ReentrancyGuard`) and double-claims (`claimed` flag, set before the
  external call).

**There is no owner-withdraw function anywhere in this contract.** The
owner (backend relayer key) can only settle or void a market — it can
never move staked funds itself. This is a deliberate security
property, not an oversight.

### What's deliberately not wired up yet

`settleMarket`/`voidMarket` exist and are fully tested, but nothing in
the Next.js app calls them yet — there is no Settlement Intelligent
Contract on the GenLayer side to produce a decision to relay (see
`genlayer/README.md`). The app only calls `stake` today. Wire
`settleMarket`/`voidMarket`/`claim` into the backend once Settlement
exists and its decisions are validated per PROJECT.md §6.

A separate `Rewards` contract (payout *history* recording, per
PROJECT.md §7) remains unstarted for the same reason — there's nothing
to record a history of yet.

## Setup

```bash
cd arc
forge install foundry-rs/forge-std --no-git
forge install OpenZeppelin/openzeppelin-contracts --no-git
```

> `lib/` isn't committed (same reasoning as excluding `node_modules`
> from the main app) and this project doesn't use git submodules, so a
> bare `forge install` with no arguments does nothing — install both
> dependencies explicitly as shown above.

## Building

```bash
forge build
```

> **Sandbox note**: if `forge build`/`forge test` fail with a network
> error trying to reach `binaries.soliditylang.org` for the solc
> compiler binary, that domain may be blocked in your environment.
> Fetch the same binary from GitHub releases instead and point Foundry
> at it, e.g.:
>
> ```bash
> curl -sSL -o solc "https://github.com/ethereum/solidity/releases/download/v0.8.28/solc-static-linux"
> chmod +x solc
> mkdir -p ~/.svm/0.8.28 && cp solc ~/.svm/0.8.28/solc-0.8.28
> forge build --offline
> ```

## Testing

```bash
forge test -vv
```

28 tests across `test/Market.t.sol` and `test/Escrow.t.sol`: access
control, registration/duplicate/lock-state guards, stake accumulation
and side-switch rejection, exact pari-mutuel payout math (asserted
against hand-computed numbers, including a full-pool-conservation
check), losing-side/double-claim/not-yet-settled reverts, the void
full-refund path, and a real reentrancy attack (a malicious contract
that tries to re-enter `claim` from its `receive()` hook, which must
revert).

## Deploying to Arc Testnet

Prerequisites: a funded Arc Testnet account (faucet:
https://faucet.circle.com — select Arc Testnet) and `ARC_PRIVATE_KEY`
for that account.

```bash
export ARC_TESTNET_RPC_URL="https://rpc.testnet.arc.network"
export PRIVATE_KEY="0x..."   # the deployer/owner key

# 1. Deploy Market (constructor: initialOwner)
forge create src/Market.sol:Market \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --constructor-args <YOUR_OWNER_ADDRESS>

# 2. Deploy Escrow (constructor: initialOwner, marketAddress)
forge create src/Escrow.sol:Escrow \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --constructor-args <YOUR_OWNER_ADDRESS> <MARKET_ADDRESS_FROM_STEP_1>

# 3. Wire Market -> Escrow (one-time, owner-only)
cast send <MARKET_ADDRESS> "setEscrow(address)" <ESCROW_ADDRESS> \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --private-key $PRIVATE_KEY
```

Save both deployed addresses into the Next.js app's `.env` —
`ARC_MARKET_CONTRACT_ADDRESS` and `ARC_ESCROW_CONTRACT_ADDRESS`
respectively (see `wager/.env.example`). `<YOUR_OWNER_ADDRESS>` should
be the address matching `ARC_PRIVATE_KEY` — Wager's backend relayer —
since it's the only address permitted to register/lock/settle/void
markets.

### Registering a market once deployed

The backend does this automatically the first time a market's stake
route is called (see `wager/src/lib/arc/*` and the stake-challenge API
route), but it can also be done manually for testing:

```bash
cast send <MARKET_ADDRESS> "registerMarket(bytes32)" <MARKET_ID_HASH> \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --private-key $PRIVATE_KEY
```

### Arc Testnet network details

| Setting     | Value                                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------- |
| RPC (HTTPS) | `https://rpc.testnet.arc.network`                                                                                   |
| Chain ID    | 5042002                                                                                                              |
| Explorer    | https://testnet.arcscan.app                                                                                         |
| Faucet      | https://faucet.circle.com                                                                                           |
| USDC ERC-20 | `0x3600000000000000000000000000000000000000` (unused by these contracts — see "why native `msg.value`" above)      |
