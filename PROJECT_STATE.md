# PROJECT_STATE.md

> Living document for **Wager**. Update after every completed
> development session.

# Current Version

v1.8.0

# Project Status

Overall Progress: ~97% (Phases 1–7 complete: all contracts, backend
pipeline, claim UI, admin auth, Rewards integration, and profile/wallet
stats implemented. Build is clean (0 errors). Only contract deployment,
live E2E validation, and production scheduling remain.)

## Completed

- Project specification completed
- Architecture defined
- PROJECT.md §6 amended per stakeholder direction (unchanged)
- Arc integration architecture decided (unchanged)
- **Phase 1 — Foundation** (unchanged)
- **Phase 2 — User System** (unchanged)
- **Phase 3 — Core Social Experience** (unchanged, fully complete)
- **Phase 4 — Fixture Discovery Contract + integration** (unchanged)
- **Phase 4 — Match Monitoring Contract + integration** (unchanged)
- **Phase 4 — Match/Market detail page** (unchanged)
- **Phase 4 — Support/Challenge + Position tracking** (unchanged — see
  v1.5.0 changelog below for full details)
- **Phase 6 — Claim UI + Admin Auth + TS Fixes:**

  All pre-existing TypeScript errors in query files fixed (Prisma
  `User`/`Profile` relation traversal). Admin authentication (Bearer
  token guard) implemented and wired into all 3 admin endpoints.
  Full claim flow (challenge → Circle Web SDK → on-chain confirm)
  implemented for both backend and frontend.

  **Admin auth** — `src/lib/admin-auth.ts`:
  - `isAdminAuthorized(request)` — Bearer token check against
    `ADMIN_API_KEY` env var. Secure default: rejects all if key unset.
  - Wired into `sync-fixtures`, `sync-match-status`, `settle-markets`

  **Claim backend** — follows exact same pattern as stake flow:
  - `src/lib/circle/client.ts` — `createClaimChallenge()`,
    `findClaimTransactionHash()`
  - `src/app/api/wallet/claim-challenge/route.ts` — validates position
    status (WON/VOID) and market status (SETTLED/VOID), creates Circle
    contract-execution challenge for `Escrow.claim(marketId)`
  - `src/app/api/wallet/claim-confirm/route.ts` — trust-nothing
    verification: locates tx hash, reads on-chain receipt via viem,
    decodes `Claimed` event, verifies marketId + staker, updates
    Position → CLAIMED and creates Transaction record atomically
  - `src/lib/socket/emit.ts` — `emitClaimCompleted()`
  - `src/lib/socket/events.ts` — `ClaimCompletedPayload` type
  - `src/lib/validation/wallet.ts` — `claimChallengeSchema`,
    `claimConfirmSchema`

  **Claim frontend** — `src/components/wallet/positions-list.tsx`:
  - Client component with `ClaimButton` for WON ("Claim Payout")
    and VOID ("Claim Refund") positions
  - Full 3-step flow: challenge → Circle SDK execute → confirm
  - Optimistic local state update on success

  **Query fixes** — all 4 query files (`match.ts`, `feed.ts`,
  `comments.ts`, `notifications.ts`) updated to select through
  `author.profile` / `actor.profile` and flatten
- **Phase 7 — Rewards Backend Integration:**

  Wired the existing `Rewards.sol` contract (Solidity + tests already
  complete from Phase 4) into the TypeScript backend and UI. Read-only
  integration — Rewards is written to automatically by `Escrow.claim()`.

  **On-chain read helper** — `src/lib/arc/rewards.ts`:
  - `getClaimRecord()`, `hasClaimedOnChain()`, `getStakerTotalPayout()`,
    `getMarketTotalPayout()` — pure viem `readContract` calls for admin
    reconciliation (not used in UI hot path)

  **Profile stats** — DB-sourced via Prisma aggregates on `Position` +
  `Transaction` tables (verified on-chain before writing in claim-confirm):
  - `totalWins`, `totalClaimed`, `winRate` added to profile query
  - Profile page (`/[username]`) shows Wins, Win Rate, Claimed stats

  **Wallet stats** — `getRewardsStats()` shows "Total Claimed" on the
  wallet card when user has at least one confirmed claim.
- **Phase 5 — Settlement Contract + Backend Integration:**

  The Settlement Intelligent Contract and its full backend pipeline,
  closing the gap between "a match finishes" and "the market is
  adjudicated and funds are distributed."

  **GenLayer contract** — `genlayer/contracts/settlement.py`:
  - Multi-source verification: fetches 1+ trusted source URLs, asks
    the LLM to verify the final score against each page independently
  - Confidence scoring: `sources_agreeing / sources_checked` — must
    be ≥ 0.8 or the market is voided (PROJECT.md §6: "Refuse uncertain
    settlement")
  - **Draw No Bet** outcome mapping (confirmed with stakeholder):
    Home win → SUPPORT, Away win → CHALLENGE, Draw → VOID (full refund)
  - Edge cases: Postponed/Abandoned/Canceled/Suspended → immediate VOID
    without source fetching; extra time/penalties ignored (MATCH_RESULT
    is decided on 90 min + stoppage only)
  - Consensus: `run_nondet_unsafe` with validator that re-fetches all
    sources independently and requires exact outcome match + agreement
    on whether confidence is above/below the threshold
  - Access control: same owner/operator pattern as Fixture Discovery
    and Match Monitoring

  **Tests** — `genlayer/tests/test_settlement.py`:
  - 26 direct-mode tests across 5 categories:
    - TestAccessControl (5): owner/operator permissions
    - TestSettlementDecisions (9): home win, away win, draws, void
      statuses, low confidence
    - TestStorageAndReads (4): storage, reads, overwrite, unknown
    - TestInputValidation (3): empty fixture/team/URL rejection
    - TestValidatorConsensus (5): agreement, disagreement, malformed
  - All 72 tests pass project-wide (20 + 26 + 26) in 13.63s

  **Backend integration** (all TypeScript, zero type errors):
  - `src/lib/genlayer/client.ts` — added `getSettlementContractAddress()`
  - `src/lib/arc/abi.ts` — added `settleMarket`, `voidMarket` function
    ABIs, `MarketSettled`/`MarketVoided` events, `MarketAlreadyClosed`/
    `MarketHasNoStakes` errors
  - `src/lib/arc/relayer.ts` — added `settleMarketOnChain()` and
    `voidMarketOnChain()`, both with graceful `MarketAlreadyClosed`
    handling (same idempotent pattern as `ensureMarketRegisteredOnChain`)
  - `src/lib/genlayer/sync-settlement.ts` — **new**: the full settlement
    sync pipeline. Finds eligible markets (MATCH_RESULT, match in
    terminal status, market still OPEN/LOCKED), reads source URLs from
    Fixture Discovery, calls the Settlement contract, validates the
    decision server-side, relays to Arc Escrow, updates Prisma (market
    status + position statuses) atomically via `$transaction`, and emits
    `settlement_completed` via Socket.IO
  - `src/lib/socket/emit.ts` — added `emitSettlementCompleted()`
  - `src/app/api/admin/settle-markets/route.ts` — **new**: admin endpoint
    `POST /api/admin/settle-markets` triggering the settlement pipeline
  - `.env.example` — added `GENLAYER_SETTLEMENT_CONTRACT_ADDRESS`
  - `genlayer/README.md` — updated contracts table, added Settlement
    Contract documentation section, updated deployment and CLI sections

## In Progress

- None (all code-complete; build is clean)

## Next Priority

**Phases 1–7 are code-complete.** Recommended next steps, in order:

1. **Deploy all three GenLayer contracts** to Bradbury Testnet (Fixture
   Discovery, Match Monitoring, Settlement) — stakeholder's own action.
   See `genlayer/README.md` for commands. Set all three
   `GENLAYER_*_CONTRACT_ADDRESS` env vars.
2. **Deploy Arc contracts** (`Market.sol`, `Escrow.sol`, `Rewards.sol`)
   to Arc Testnet — see `arc/README.md`. Wire: `Market.setEscrow()`,
   `Escrow.setRewards()`, `Rewards.setEscrow()`.
3. **Live E2E validation** — exercise the full flow against real
   infrastructure: fixture discovery → match monitoring → settlement →
   claim → rewards recorded. Nothing tested against live infra yet.
4. **Production scheduling** — deploy to Vercel, then set up
   cron-job.org (free tier) to hit admin endpoints:

   | Job | Endpoint | Schedule |
   |---|---|---|
   | Sync Fixtures | `POST /api/admin/sync-fixtures` | Every 6 hours |
   | Sync Match Status | `POST /api/admin/sync-match-status` | Every 15 min |
   | Settle Markets | `POST /api/admin/settle-markets` | Every 30 min |

   Each job needs header: `Authorization: Bearer <ADMIN_API_KEY>`.
   Fixture/match sync jobs work before contract deployment (they talk
   to football-data.org). Settlement will find no eligible markets
   until contracts are deployed — harmless.

# Current Architecture

Frontend — Next.js (App Router) — React — TypeScript (strict) — Tailwind
CSS v4 — shadcn/ui (hand-configured)

Backend — Next.js Route Handlers — Prisma — PostgreSQL — Socket.IO
(custom `server.ts`) — Auth.js v5 (split edge/Node config) — Supabase
Storage (avatar uploads) — `genlayer-js` client for GenLayer Bradbury
Testnet — viem + `@circle-fin/user-controlled-wallets` +
`@circle-fin/w3s-pw-web-sdk` for Arc Testnet

Blockchain — GenLayer Bradbury Testnet: Fixture Discovery, Match
Monitoring, and **Settlement** contracts implemented, linted, tested
(72/72 passing), undeployed. Arc Testnet: `Market`/`Escrow` contracts
implemented, tested (28/28 passing via real `forge test`), undeployed.

# GenLayer Intelligent Contracts

Fixture Discovery Contract — Implemented, linted, tested. Not yet
deployed. `genlayer/contracts/fixture_discovery.py`
Match Monitoring Contract — Implemented, linted, tested. Not yet
deployed. `genlayer/contracts/match_monitoring.py`
Settlement Contract — **Implemented, linted, tested (26/26). Not yet
deployed.** `genlayer/contracts/settlement.py`

# Arc Smart Contracts

Escrow Contract — Implemented, tested (28/28 via `forge test`), not
deployed. `arc/src/Escrow.sol`. `stake` wired into the app;
`settleMarket`/`voidMarket` wired via `relayer.ts`;
**`claim` now wired** via `claim-challenge`/`claim-confirm` routes.
Market Contract — Implemented, tested, not deployed.
`arc/src/Market.sol`. Fully wired (register/record-stake).
Rewards Contract — **Implemented, tested (14 tests), backend
integration complete.** `arc/src/Rewards.sol`. On-chain read helper
(`src/lib/arc/rewards.ts`) + DB-sourced stats on profile/wallet pages.
Not yet deployed.

# Database

Status: Schema unchanged this session. `prisma@6.19.3` pinned (was
`^7.8.0` — Prisma 7 has a breaking change removing `url` from
`datasource` blocks; downpinned to restore compatibility).
Latest Migration: None. `npm run db:push` remains the documented path.
Schema location: `prisma/schema.prisma`

# Recent Changes

_All prior changelog entries from v1.5.0 and v1.6.0 remain valid and
unchanged — see the git history or prior versions of this file._

- **Phase 7 — Rewards Backend Integration (v1.8.0)**:
  - `src/lib/arc/config.ts` — changed: added `getRewardsContractAddress()`
  - `src/lib/arc/abi.ts` — changed: added `REWARDS_ABI` (4 view functions
    + `ClaimRecorded` event)
  - `src/lib/arc/rewards.ts` — new: on-chain read helper for Rewards
    contract (`getClaimRecord`, `hasClaimedOnChain`, `getStakerTotalPayout`,
    `getMarketTotalPayout`)
  - `src/lib/queries/profile.ts` — changed: added DB-sourced reward stats
    (`totalWins`, `totalClaimed`, `winRate`) via Prisma aggregates
  - `src/app/[username]/page.tsx` — changed: added Wins, Win Rate,
    Claimed stats row on profile page
  - `src/components/profile/profile-stat.tsx` — changed: widened value
    type to `number | string`
  - `src/lib/queries/wallet.ts` — changed: added `getRewardsStats()`
  - `src/components/wallet/wallet-card.tsx` — changed: shows "Total
    Claimed" stat when user has claimed at least once
  - `src/app/wallet/page.tsx` — changed: passes `rewardsStats` to
    `WalletCard`

- **Phase 6 — Claim UI + Admin Auth + TS Fixes (v1.7.0)**:
  - `src/lib/admin-auth.ts` — new: Bearer token admin guard
  - `src/app/api/admin/sync-fixtures/route.ts` — changed: wired admin auth
  - `src/app/api/admin/sync-match-status/route.ts` — changed: wired admin auth
  - `src/app/api/admin/settle-markets/route.ts` — changed: wired admin auth
  - `src/lib/circle/client.ts` — changed: added `createClaimChallenge()`,
    `findClaimTransactionHash()`
  - `src/lib/validation/wallet.ts` — changed: added claim schemas
  - `src/app/api/wallet/claim-challenge/route.ts` — new: claim challenge endpoint
  - `src/app/api/wallet/claim-confirm/route.ts` — new: claim confirm endpoint
  - `src/lib/socket/emit.ts` — changed: added `emitClaimCompleted()`
  - `src/lib/socket/events.ts` — changed: added `ClaimCompletedPayload`
  - `src/components/wallet/positions-list.tsx` — changed: added ClaimButton
  - `src/lib/queries/match.ts` — changed: profile-based author select
  - `src/lib/queries/feed.ts` — changed: profile-based author select
  - `src/lib/queries/comments.ts` — changed: profile-based author select
  - `src/lib/queries/notifications.ts` — changed: profile-based actor select
  - `.env.example` — changed: added `ADMIN_API_KEY`

- **TypeScript fix (v1.6.1)**:
  - `src/app/api/predictions/[id]/comments/route.ts` — fixed `prisma.comment.create`
    select: was trying to select `username`/`displayName`/`avatarUrl` directly on
    the `User` model (they live on `Profile`). Fixed to select through
    `author.profile` then flatten inline. `tsc --noEmit` now exits 0.

- **Phase 5 — Settlement Contract + Backend Integration (v1.6.0)**:
  - `genlayer/contracts/settlement.py` — new: Settlement Intelligent
    Contract with multi-source verification, Draw No Bet model,
    confidence thresholding, VOID path for draws/abnormal matches
  - `genlayer/tests/test_settlement.py` — new: 26 direct-mode tests
  - `src/lib/genlayer/client.ts` — changed: added
    `getSettlementContractAddress()`
  - `src/lib/genlayer/sync-settlement.ts` — new: full settlement sync
    pipeline
  - `src/lib/arc/abi.ts` — changed: added settlement ABI fragments
  - `src/lib/arc/relayer.ts` — changed: added `settleMarketOnChain()`,
    `voidMarketOnChain()`
  - `src/lib/socket/emit.ts` — changed: added
    `emitSettlementCompleted()`
  - `src/app/api/admin/settle-markets/route.ts` — new: admin settlement
    endpoint
  - `.env.example` — changed: added
    `GENLAYER_SETTLEMENT_CONTRACT_ADDRESS`
  - `genlayer/README.md` — changed: Settlement docs, deployment,
    CLI examples
  - `package.json` — changed: pinned `prisma@6`, `@prisma/client@6`

# Modified Files

- All files through Phase 4 (Support/Challenge + Position tracking) —
  see v1.5.0 changelog, unchanged.
- Phase 5 — Settlement:
  - `genlayer/contracts/settlement.py` (new)
  - `genlayer/tests/test_settlement.py` (new)
  - `genlayer/README.md` (changed)
  - `src/lib/genlayer/client.ts` (changed)
  - `src/lib/genlayer/sync-settlement.ts` (new)
  - `src/lib/arc/abi.ts` (changed)
  - `src/lib/arc/relayer.ts` (changed)
  - `src/lib/socket/emit.ts` (changed)
  - `src/app/api/admin/settle-markets/route.ts` (new)
  - `.env.example` (changed)
  - `package.json` (changed — Prisma version pin)
- Phase 6 — Claim UI + Admin Auth + TS Fixes:
  - `src/lib/admin-auth.ts` (new)
  - `src/app/api/admin/sync-fixtures/route.ts` (changed)
  - `src/app/api/admin/sync-match-status/route.ts` (changed)
  - `src/app/api/admin/settle-markets/route.ts` (changed)
  - `src/lib/circle/client.ts` (changed)
  - `src/lib/validation/wallet.ts` (changed)
  - `src/app/api/wallet/claim-challenge/route.ts` (new)
  - `src/app/api/wallet/claim-confirm/route.ts` (new)
  - `src/lib/socket/emit.ts` (changed)
  - `src/lib/socket/events.ts` (changed)
  - `src/components/wallet/positions-list.tsx` (changed)
  - `src/lib/queries/match.ts` (changed)
  - `src/lib/queries/feed.ts` (changed)
  - `src/lib/queries/comments.ts` (changed)
  - `src/lib/queries/notifications.ts` (changed)
  - `.env.example` (changed)
- Phase 7 — Rewards Backend Integration:
  - `src/lib/arc/config.ts` (changed)
  - `src/lib/arc/abi.ts` (changed)
  - `src/lib/arc/rewards.ts` (new)
  - `src/lib/queries/profile.ts` (changed)
  - `src/app/[username]/page.tsx` (changed)
  - `src/components/profile/profile-stat.tsx` (changed)
  - `src/lib/queries/wallet.ts` (changed)
  - `src/components/wallet/wallet-card.tsx` (changed)
  - `src/app/wallet/page.tsx` (changed)

# Known Bugs

None.

# Technical Debt / Known Environment Limitations

- **Prisma 7 breaking change** — `package.json` was pinning `^7.8.0`
  which removes `datasource.url` from schema files. Downpinned to
  `prisma@6`/`@prisma/client@6` to restore compatibility. If upgrading
  to Prisma 7 in the future, the schema needs migration to use
  `prisma.config.ts` for the connection URL.
- **`genlayer-test` Windows bug** — `os.unlink()` on a temp file held
  open by `os.dup2` throws `PermissionError` on Windows. Patched locally
  in `gltest/direct/loader.py` with a try/except. This patch will be
  lost on reinstall — upstream should fix this.
- **Empty `genlayer` stub in global Python** — there was an empty
  `C:\Python312\Lib\site-packages\genlayer\__init__.py` (0 bytes) that
  shadowed the real SDK module provided by the GenVM binary. Deleted.
  If `genlayer-test` is reinstalled globally (not `--user`), this may
  reappear.
- **TypeScript build** — Clean as of v1.8.0. Zero errors (`tsc --noEmit
  exit 0`).
- Prisma client generation requires real network access (unchanged).
- Neither GenLayer contracts nor Arc contracts are deployed (unchanged).
- Nothing in Circle/Arc integration tested against live infra (unchanged).
- `genlayer-test`'s upstream version-resolution bug (unchanged).
- `prisma/seed.ts` still pending retirement (unchanged).
- Supabase Storage bucket still needs creating (unchanged).
- Socket.IO vs. Vercel serverless still open (unchanged).
- Auth.js v5 still in beta (unchanged).
- `odds_updated` Socket.IO event remains unwired (may not be needed).
- `Position.status` full lifecycle now implemented: `OPEN` → `WON`/
  `LOST`/`VOID` (via `sync-settlement.ts`) → `CLAIMED` (via claim UI).

# Pending Decisions

- Final logo / branding assets
- Real-time hosting on Vercel (unchanged)
- How syncs get triggered on a schedule in production (unchanged)

# Current Environment

Frontend: `/wallet` page with claim UI, live staking panel on
`/matches/[id]`.
Backend: **Nine** `/api/admin/*` and `/api/wallet/*` routes. All admin
routes secured via `ADMIN_API_KEY`. New: `POST /api/wallet/claim-challenge`,
`POST /api/wallet/claim-confirm`. Requires `CIRCLE_API_KEY`,
`ARC_PRIVATE_KEY`, `ADMIN_API_KEY`, contract addresses, and
`GENLAYER_SETTLEMENT_CONTRACT_ADDRESS` to function against real
infrastructure.
Database: Schema unchanged this session; Prisma downpinned to v6.
GenLayer: **All three contracts** implemented and passing 72/72 combined
local tests; none deployed to Bradbury Testnet yet.
Arc: `Market`/`Escrow` contracts implemented and passing 28/28 local
`forge test`s; neither deployed to Arc Testnet yet. `settleMarket`/
`voidMarket` now wired into the backend via `relayer.ts`.
Supabase Storage: Not configured.

# Definition of Done

A task is complete only if:

- Feature works.
- Build passes.
- TypeScript passes.
- Lint passes.
- Documentation updated.
- No known regressions.

# Session Handoff

## Summary

Phases 1–7 are code-complete. The full application flow from fixture
discovery through settlement through claim payout is implemented, with
reward stats surfaced on profile and wallet pages. Admin endpoints are
secured. TypeScript build is clean.

## Files Modified

See "Modified Files" above.

## Bugs Fixed

1. **Empty `genlayer` stub shadowing SDK** — Deleted.
2. **`genlayer-test` Windows `os.unlink` crash** — Patched with try/except.
3. **Prisma 7 breaking change** — Downpinned to `prisma@6`.
4. **Query TS errors** — Fixed profile-based selects in all 4 query files.

## Remaining Issues

1. No contracts deployed (GenLayer or Arc) — stakeholder's own action.
2. Nothing tested against live Circle/Arc/GenLayer infrastructure.
3. `genlayer-test` Windows patch is local — will be lost on reinstall.

## Next Recommended Task

Deploy all contracts (3 GenLayer + 3 Arc) and exercise the full E2E
flow against live infrastructure. Then: production scheduling.

## Notes for Next AI Session

Read `PROJECT.md` first (§6 and §7), then this file. Phases 1–7 are
complete — don't rebuild anything. The next task is **contract
deployment and live E2E validation** (stakeholder action), then
**production scheduling** (cron-job.org). The `genlayer-test` Windows
patch in `gltest/direct/loader.py` is local and will be lost on
`pip install --force-reinstall` — if tests fail with
`PermissionError: [WinError 32]`, re-apply the `os.unlink` try/except
fix. Prisma is pinned at v6 — do not upgrade to v7 without migrating
the schema to use `prisma.config.ts`.

