# Wager — GenLayer Intelligent Contracts

Intelligent Contracts for Wager's decentralized intelligence layer
(PROJECT.md §6). Deployment target: **GenLayer Bradbury Testnet**.

## Contracts

| Contract          | File                             | Status              |
| ----------------- | -------------------------------- | ------------------- |
| Fixture Discovery | `contracts/fixture_discovery.py` | Implemented, tested |
| Match Monitoring  | `contracts/match_monitoring.py`  | Implemented, tested |
| Settlement        | `contracts/settlement.py`        | Implemented, tested |

## Fixture Discovery Contract

Discovers upcoming fixtures for a competition from a trusted web source,
extracts them via LLM inside a non-deterministic block, reaches
validator consensus on the extracted set (Jaccard similarity ≥ 0.8 over
`(home_team, away_team, kickoff_iso)` tuples — tolerates minor wording
differences between validators' independent extractions without
accepting a genuinely different fixture set), then stores each new
fixture and opens a canonical `MATCH_RESULT` market for it.

This is the real implementation of what `prisma/seed.ts` (in the
Next.js app) has stood in for since Phase 3. Once this contract is
deployed and a backend sync job reads its output into the `Match`/
`Market` Prisma tables, `prisma/seed.ts` should be deleted.

### Access control

- **Owner** — the deploying address. Can add/remove operators.
- **Operators** — addresses authorized to call `discover_fixtures`
  (the owner is always implicitly an operator). In production this
  will be Wager's backend service account, so scheduled syncs can run
  without the owner key being hot.

### Consensus design notes

- `discover_fixtures` uses `gl.vm.run_nondet_unsafe` with a custom
  `validator_fn`, not `strict_eq` — LLM extraction is inherently
  non-deterministic (wording, ordering), so exact-match consensus
  would never agree. See the GenLayer docs' Equivalence Principle
  page for why.
- The validator **disagrees** (forcing a leader rotation) on: leader
  errors, malformed leader output, or a fixture set with insufficient
  overlap with its own independent extraction. It only **agrees** when
  the two extractions are the same set or reasonably close to it, or
  when both find zero fixtures.
- Duplicate fixtures (same competition/teams/kickoff, from a prior
  discovery run) are silently skipped, not treated as an error —
  running discovery repeatedly against the same source is expected
  and should be idempotent.

## Match Monitoring Contract

Tracks a fixture's live status and score. Given a fixture id, team
names, and a trusted source URL, fetches the page, extracts the
current status and score via LLM, reaches validator consensus, then
stores and returns the result.

Unlike Fixture Discovery's fuzzy team-name/kickoff similarity check,
this contract's consensus rule requires **exact equality** on the
extracted `(status, home_score, away_score)` tuple — these are
objective facts (an actual score, one of seven controlled status
values), not free-form text, so an honest independent extraction
should land on precisely the same result. Any mismatch — or the
leader erroring, returning a malformed shape, an unrecognized status
string, or a non-integer/negative score — causes the validator to
disagree, forcing a leader rotation rather than accepting a
questionable result.

### Status values

Mirrors Wager's Prisma `MatchStatus` enum exactly: `SCHEDULED`,
`LIVE`, `FINISHED`, `POSTPONED`, `SUSPENDED`, `ABANDONED`, `CANCELED`.
The prompt gives the LLM an explicit definition of each so postponement
(rescheduled before kickoff) is distinguished from suspension
(halted mid-match, expected to resume) and abandonment (halted
mid-match, will not resume) — the three cases PROJECT.md §6 calls out
by name under "Detect postponements."

### Score representation

`NO_SCORE = -1` internally, translated to `null`/`None` at every read
path (`check_match`'s own return value **and** `get_match_state` — an
earlier draft only did this translation in `get_match_state`, missed
it in `check_match`'s return, and a direct-mode test caught the
inconsistency before it shipped). This distinguishes "no score known
yet" from a genuine 0-0 scoreline.

### Calling this contract from the backend

Match Monitoring doesn't independently know a fixture's source URL —
it's called with team names and a URL supplied by the caller. Wager's
backend reads the source URL from the **Fixture Discovery** contract's
`get_fixture` (both contracts are meant to be used together, each
owning one piece of non-deterministic reasoning) — see
`src/lib/genlayer/sync-match-status.ts` in the Next.js app.

## Settlement Contract

Adjudicates a `MATCH_RESULT` market after a match finishes (or is
voided due to postponement/abandonment/etc.). Given a fixture id, team
names, the final score from Match Monitoring, and 1+ trusted source
URLs, fetches each source independently, asks an LLM to verify the
final score against each page, computes a confidence score from the
fraction of sources that agree, then produces a settlement decision.

### Settlement model: Draw No Bet

| Real-World Result | Outcome       | Effect                           |
| ----------------- | ------------- | -------------------------------- |
| Home win          | `SUPPORT`     | Home-side stakers win the pot    |
| Away win          | `CHALLENGE`   | Away-side stakers win the pot    |
| Draw              | `VOID`        | All stakers get a full refund    |

This follows the "Draw No Bet" model used by major football betting
platforms — a draw is genuinely neither side's predicted outcome, so
all stakes are returned.

### Confidence and refusal

Sources are verified individually and confidence is calculated as the
fraction of sources that confirm the exact final score. If confidence
is below 0.8, the settlement outcome is forced to `VOID` (full refund)
rather than settling with a potentially incorrect outcome. This
implements PROJECT.md §6's "Refuse uncertain settlement" requirement.

### Edge cases

- **Postponed/Suspended/Abandoned/Canceled** matches are immediately
  voided without fetching any sources — the match never produced a
  valid full-time result.
- **Extra time / penalties**: The LLM prompt explicitly instructs that
  `MATCH_RESULT` is decided on the full-time score (90 minutes +
  stoppage time) only. Extra time and penalty shootout results are
  ignored.
- **Conflicting sources**: If sources disagree on the score, fewer
  sources confirm → confidence drops below threshold → `VOID`.

### Consensus design notes

- Uses `gl.vm.run_nondet_unsafe` with a custom `validator_fn` (same
  pattern as Match Monitoring).
- The validator re-fetches all sources independently and requires:
  1. Exact match on `outcome` (objective decision from objective score)
  2. Agreement on whether confidence is above or below the threshold
     (the binary settle-vs-void decision must agree, but the exact
     confidence value may differ slightly)
- The validator **disagrees** on: leader errors, malformed leader
  output, or a different outcome/confidence-threshold decision. It only
  **agrees** when both independently reach the same adjudication.

### Calling this contract from the backend

The settlement sync pipeline (`src/lib/genlayer/sync-settlement.ts`)
finds markets eligible for settlement (match finished + market still
open), reads each fixture's source URL from Fixture Discovery, calls
this contract's `settle_market`, validates the decision server-side,
then relays it to the Arc Escrow contract (`settleMarket`/`voidMarket`)
and updates Prisma. See `POST /api/admin/settle-markets`.

## Setup

```bash
cd genlayer
pip install genvm-linter genlayer-test --break-system-packages
```

## Linting

```bash
genvm-lint check contracts/fixture_discovery.py
```

Runs both fast AST safety checks and full SDK-based semantic
validation (decorators, storage types, method signatures).

## Testing

```bash
pytest tests/ -v
```

Direct-mode tests run the contract's actual Python code against the
real GenVM SDK in-process (no Docker, no Studio) with mocked web/LLM
responses — including exercising the validator consensus logic itself
via `direct_vm.run_validator()`.

> **Known upstream issue**: `genlayer-test`'s auto-resolved "latest"
> GenVM version currently 404s, because `genlayerlabs/genvm` was
> renamed to `genlayerlabs/genvm-manager` upstream and the installed
> package version (0.29.2) still points at the old repo name for its
> release-asset URL. Tests in this repo pin `sdk_version="v0.2.16"`
> explicitly to work around this — remove the pin once a newer
> `genlayer-test` release fixes its own version resolution.

## Deploying to Bradbury Testnet

Prerequisites: a funded Bradbury Testnet account (faucet:
https://testnet-faucet.genlayer.foundation) and the GenLayer CLI
(`npm install -g genlayer`).

```bash
genlayer network testnet-bradbury
genlayer deploy --contract contracts/fixture_discovery.py
genlayer deploy --contract contracts/match_monitoring.py
genlayer deploy --contract contracts/settlement.py
```

Save each deployed contract address into the Next.js app's
`.env` — `GENLAYER_FIXTURE_DISCOVERY_CONTRACT_ADDRESS`,
`GENLAYER_MATCH_MONITORING_CONTRACT_ADDRESS`, and
`GENLAYER_SETTLEMENT_CONTRACT_ADDRESS` respectively (see
`wager/.env.example`). If the same operator account will call all
contracts, add it as an operator on each separately — operator lists
are per-contract, not shared.

### Bradbury network details

| Setting      | Value                                      |
| ------------ | ------------------------------------------ |
| GenLayer RPC | `https://rpc-bradbury.genlayer.com`        |
| Chain ID     | 4221                                       |
| Explorer     | https://explorer-bradbury.genlayer.com     |
| Faucet       | https://testnet-faucet.genlayer.foundation |

## Calling the contracts once deployed

```bash
# Trigger fixture discovery for a competition (owner/operator only)
genlayer write --contract <fixture_discovery_address> \
  --method discover_fixtures \
  --args "Premier League" "https://www.premierleague.com/fixtures"

# Read discovered fixtures
genlayer call --contract <fixture_discovery_address> \
  --method get_fixture_ids

# Check a specific match's live status/score (owner/operator only)
genlayer write --contract <match_monitoring_address> \
  --method check_match \
  --args "<fixture_id>" "Arsenal" "Chelsea" "https://example.com/match"

# Read a match's last-known status/score
genlayer call --contract <match_monitoring_address> \
  --method get_match_state --args "<fixture_id>"

# Settle a finished match's market (owner/operator only)
genlayer write --contract <settlement_address> \
  --method settle_market \
  --args "<fixture_id>" "Arsenal" "Chelsea" "FINISHED" 2 1 \
    "https://www.premierleague.com/results,https://www.bbc.co.uk/sport/football/scores-fixtures"

# Read a settlement decision
genlayer call --contract <settlement_address> \
  --method get_settlement --args "<fixture_id>"
```

Wager's backend calls these same methods via `genlayer-js` — see
`wager/src/lib/genlayer/sync-fixtures.ts`,
`wager/src/lib/genlayer/sync-match-status.ts`, and
`wager/src/lib/genlayer/sync-settlement.ts`, wired to
`POST /api/admin/sync-fixtures`,
`POST /api/admin/sync-match-status`, and
`POST /api/admin/settle-markets` respectively. The settlement sync
job reads each fixture's source URL from Fixture Discovery before
calling Settlement — all three contracts are designed to be used
together, each owning one piece of non-deterministic reasoning.
