# Wager — GenLayer Agent Tank Hackathon Submission Package

> **Submission Document for Portal Reviewers & Judging Team**  
> **Project:** Wager  
> **Target Network:** GenLayer Studio Next (Consensus v0.6, Chain ID: `61997`)  
> **Repository:** https://github.com/oxmoriarty/wager.git  

---

## 1. Executive Summary & Pitch

**Wager** is a decentralized social prediction market where football fans make predictions, debate in threaded conversations, stake USDC on match outcomes, and receive automatic payouts settled by **GenLayer Intelligent Contracts**.

### The Core Innovation: Autonomous AI Adjudication
Traditional prediction platforms depend on centralized oracles or rigid, expensive API feeds. When an API goes down, changes schema, or reports conflicting data, markets freeze or settle unfairly.

Wager replaces centralized oracles with **three GenLayer Intelligent Contracts** that run on **Studio Next**:
1. **`FixtureDiscovery.py`** — Scrapes unstructured web sources, extracts upcoming fixtures using LLMs, and achieves consensus across validator nodes via **`prompt_comparative`**.
2. **`MatchMonitoring.py`** — Monitors live match scores and terminal statuses (`FINISHED`, `POSTPONED`, `ABANDONED`) with exact validator consensus.
3. **`Settlement.py`** — Executes **Draw No Bet** adjudication with multi-source verification and confidence scoring. If sources conflict or confidence drops below 80%, the market is automatically voided to protect stakers.

---

## 2. Answers to Portal Review & Judging Criteria

### Q1: Does the app actually call a real GenLayer contract?
**Yes.** Wager integrates three deployed GenLayer Intelligent Contracts on **Studio Next (Consensus v0.6)**:
- **Fixture Discovery**: `discover_fixtures(competition, source_url)`
- **Match Monitoring**: `check_match(fixture_id, home_team, away_team, source_url)`
- **Settlement**: `settle_market(fixture_id, home_team, away_team, status, home_score, away_score, source_urls)`

All contract interactions use the Consensus v0.6 release family (`genlayer-js@2.0.0-rc.1`, `@genlayer/transaction-kit@0.1.0-rc.2`, and `@genlayer/transaction-kit-react@0.1.0-rc.2`). Write transactions are verified using `isSuccessful()` to guarantee both `FINALIZED` consensus and `FINISHED_WITH_RETURN` execution before state changes are mirrored into Postgres.

### Q2: Why does decentralized judgment matter to this problem?
Prediction markets require non-deterministic reasoning:
- Football schedules, postponements, and scorelines live in human-readable HTML across various sports websites, not in clean deterministic smart contract state.
- **Centralized oracles** introduce a single point of censorship or corruption.
- **Purely deterministic smart contracts** cannot crawl the web or parse natural language.
- **GenLayer’s Optimistic Democracy** enables independent validator nodes to scrape web pages and prompt LLMs while using comparative equivalence (`prompt_comparative`) to verify that the extracted match data refers to the same real-world event. This delivers autonomous, censorship-resistant market creation and adjudication.

### Q3: Does the contract maintain meaningful state, and does its validator check the meaningful outcome?
**Yes:**
- **State Maintenance**:
  - `FixtureDiscovery` stores canonical fixtures (`TreeMap[str, Fixture]`) and initializes open markets (`TreeMap[str, Market]`).
  - `MatchMonitoring` stores the verified score, timestamp, and match lifecycle status (`SCHEDULED`, `LIVE`, `FINISHED`, `POSTPONED`, etc.).
  - `Settlement` records multi-source confidence scores and the definitive Draw No Bet outcome (`SUPPORT`, `CHALLENGE`, `VOID`).
- **Validator Consensus Logic**:
  - `FixtureDiscovery` uses `gl.eq_principle.prompt_comparative` with a domain-specific principle to compare the leader's and validator's independent web scrapes. It tolerates wording variations ("Man City" vs "Manchester City") and timezone representations while strictly enforcing that identical football matches were discovered.
  - `MatchMonitoring` enforces **strict equality** on scores and statuses because scorelines are objective facts.
  - `Settlement` independently checks multiple source URLs and enforces that confidence $\ge 0.8$; otherwise, it forces a `VOID` refund.

### Q4: Does the repository build and work?
**Yes.**
- `npm run typecheck` passes with **0 TypeScript errors**.
- `npm run build` compiles cleanly with Next.js 16 and Turbopack.
- Python unit tests in `genlayer/tests/` pass with direct-mode VM test validation.

---

## 3. Network & Infrastructure Configuration

| Setting | Value |
|---|---|
| **Network Name** | GenLayer Studio Next |
| **RPC URL** | `https://studio-next.genlayer.com/api` |
| **Chain ID** | `61997` |
| **Consensus Engine** | Consensus v0.6 |
| **Block Explorer** | [https://explorer-studio-dev.genlayer.com/](https://explorer-studio-dev.genlayer.com/) |
| **SDK & Kit Packages** | `genlayer-js@2.0.0-rc.1`, `@genlayer/transaction-kit@0.1.0-rc.2`, `@genlayer/transaction-kit-react@0.1.0-rc.2` |
| **Settlement Escrow Chain** | Arc Testnet (USDC Staking & Non-custodial Escrow) |

---

## 4. Demo Video Script & Walkthrough (Mandatory 3-Minute Video)

Use this outline when recording your hackathon demo video:

### [0:00 - 0:40] Introduction & Problem
- **Visual:** Open Wager home feed showing match cards and live predictions.
- **Narrative:** "Welcome to Wager. In traditional sports betting and prediction markets, centralized oracles dictate what matches exist and who won. If the oracle fails or censors, users lose. Wager solves this by using GenLayer's decentralized intelligence layer on Studio Next."

### [0:40 - 1:30] GenLayer Autonomous Fixture Discovery
- **Visual:** Show terminal or Studio Next Explorer showing `discover_fixtures` transaction.
- **Narrative:** "Wager doesn't use a static database. We call GenLayer's `FixtureDiscovery` contract with a competition and a public web source. Multiple validator nodes scrape the website independently, run LLM extraction, and reach consensus using GenLayer's `prompt_comparative` equivalence principle. Even if sources write 'Man City' or 'Manchester City', the validators reach consensus on the true match."
- **Show:** The discovered matches appearing in Wager's matches tab.

### [1:30 - 2:15] User Experience: Social Prediction & Staking
- **Visual:** Click into a match (e.g. Arsenal vs Chelsea).
- **Narrative:** "Users can debate predictions in our tree-threaded conversation view. When ready to stake, they choose SUPPORT (Home) or CHALLENGE (Away) with USDC. Using Circle's embedded user-controlled wallet, users sign with a passkey/PIN — no seed phrase friction."

### [2:15 - 2:45] Multi-Source Settlement & Payout
- **Visual:** Navigate to `/wallet` showing active position, then show the `settle_market` execution.
- **Narrative:** "When the match ends, GenLayer's `Settlement` contract pulls multiple independent news and sports feeds. If validators agree on the score with at least 80% confidence, the market settles via Draw No Bet. Stakers click 'Claim Payout' and instantly receive their USDC and rewards."

### [2:45 - 3:00] Conclusion
- **Visual:** Profile page showing updated Wins, Win Rate, and Total Claimed.
- **Narrative:** "Wager is decentralized prediction markets made social, transparent, and autonomous with GenLayer Studio Next. Built for the Agent Tank Hackathon."

---

## 5. Judge & Reviewer Step-by-Step Verification Guide

Portal reviewers can verify the project locally or via our deployed Vercel instance:

### Step 1: Clone and Install
```bash
git clone https://github.com/oxmoriarty/wager.git
cd wager
npm ci
```

### Step 2: Run Verification Checks
```bash
# Verify TypeScript typing with GenLayer v2 & Transaction Kit
npm run typecheck

# Verify Next.js production build
npm run build
```

### Step 3: Run GenLayer Contract Unit Tests
```bash
cd genlayer
pip install -r requirements.txt
pytest tests/test_fixture_discovery.py -v
```

### Step 4: Inspect GenLayer Contracts on Studio Next
Reviewers can view the contract code and transactions on the official Studio Next Explorer:
- **Explorer:** [https://explorer-studio-dev.genlayer.com/](https://explorer-studio-dev.genlayer.com/)
- Contract files:
  - `genlayer/contracts/fixture_discovery.py`
  - `genlayer/contracts/match_monitoring.py`
  - `genlayer/contracts/settlement.py`
