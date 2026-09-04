# PROJECT.md

> **Wager** --- Engineering Specification v0.6

# 1. Vision

Wager is a social football prediction platform built on GenLayer
Bradbury Testnet and Arc Testnet.

GenLayer provides decentralized intelligence through Intelligent
Contracts for fixture discovery, live match monitoring, and market
settlement.

Arc manages USDC deposits, escrow, payouts, and withdrawals.

Wager should feel like a premium social platform---not a sportsbook,
casino, or trading terminal.

---

# 2. Product Specification

## Product Overview

### What Wager Is

A social platform where every post is a football prediction attached to
a canonical prediction market and optionally backed by USDC.

### What Wager Is Not

- Sportsbook
- Casino
- Trading terminal
- Generic social network
- Fantasy football app

## Core Principles

- Users create prediction posts.
- Users never create markets.
- Markets are generated automatically.
- Every prediction belongs to one canonical market.
- Social interactions stay off-chain.
- Financial state stays on-chain.
- Prediction posts are immutable.
- GenLayer determines truth.
- Arc moves money.

## User Journey

Landing Page → Sign Up / Sign In → Profile Setup (first login) →
Discover Feed → Prediction Details → Support or Challenge → Fund Wallet
(when needed) → Track Position → Settlement → Claim Rewards → Withdraw

## Core Features

- Authentication
- Profile customization
- Discover feed
- Prediction posts
- Likes
- Comments
- Reposts
- Follow system
- Notifications
- Wallet
- Deposits
- Withdrawals
- Live markets
- Automatic settlement

---

# 3. UI/UX Design System

## Design Philosophy

- Premium consumer experience
- Social first
- Finance second
- Minimal and elegant
- Fast and responsive
- One primary action per screen

Avoid:

- Casino styling
- Loud gradients
- Excessive glassmorphism
- Visual clutter

## Design Inspiration

- Linear
- Vercel
- Stripe
- Notion
- X (Twitter)

## Colors

Canvas: #121824

Surface: #1B2333

Border: #2A354A

Primary Text: #FFFFFF

Secondary Text: #94A3B8

Accent: #1800AD

Success: #22C55E

Warning: #F59E0B

Error: #EF4444

## Typography

Single font family.

Clear hierarchy.

Body line-height ≥ 1.5.

## Layout

- 8-point spacing system
- Large whitespace
- Rounded corners
- Soft shadows
- Mobile-first

## Components

- Buttons
- Inputs
- Prediction Cards
- User Cards
- Wallet Cards
- Comment Cards
- Notifications
- Toasts
- Modals
- Skeletons

Every component supports:

- Loading
- Disabled
- Hover
- Pressed
- Success
- Error

---

# 4. Technical Architecture

## Principles

- Modular architecture
- Strict TypeScript
- Server Components by default
- Minimal client JavaScript
- Shared business logic
- Reusable components

## Stack

Frontend

- Next.js
- React
- Tailwind CSS
- shadcn/ui

Backend

- Next.js Route Handlers
- Prisma
- Socket.IO

Database

- PostgreSQL

Blockchain

- GenLayer Bradbury Testnet
- Arc Testnet

Storage

- Supabase Storage

## Responsibilities

Frontend

- UI
- Authentication
- Feed
- Wallet
- Profiles

Backend

- APIs
- WebSockets
- GenLayer orchestration
- Arc orchestration

---

# 5. Database Design

## Core Entities

- User
- Profile
- Match
- Market
- Prediction
- Position
- Comment
- Like
- Repost
- Follow
- Notification
- Transaction

## Constraints

- Unique usernames
- One canonical market per match and market type
- Immutable predictions
- No duplicate likes
- No self-follow
- One follow relationship per user pair

---

# 6. GenLayer Architecture & Intelligent Contracts

## Purpose

GenLayer is Wager's decentralized intelligence layer.

Arc is the financial execution layer.

**Governing principle**: any operation that is non-deterministic —
requires natural-language interpretation, live web data, an LLM call,
or judgment that could reasonably differ between two honest
implementations — is handled by a GenLayer Intelligent Contract, not
by backend application code. This applies beyond settlement: fixture
discovery, match monitoring, and settlement are the three Intelligent
Contracts today because those are the three places non-determinism
currently enters the system. If a future feature introduces a new
non-deterministic decision, it gets a GenLayer Intelligent Contract
too, rather than an LLM call from a Next.js Route Handler.

## Intelligent Contracts

### Fixture Discovery Contract

- Discover fixtures
- Validate fixtures
- Create canonical markets

### Match Monitoring Contract

- Live score monitoring
- Match state updates
- Detect postponements

### Settlement Contract

- Verify results
- Compare trusted sources
- Produce settlement decisions

## Trusted Sources

Priority:

1.  Official competition websites
2.  Official club websites
3.  Official league data
4.  Trusted sports websites
5.  Official federation announcements

## Settlement Workflow

Match Ends

↓

Settlement Intelligent Contract

↓

Collect evidence

↓

Compare trusted sources

↓

Reach adjudication

↓

Backend validation

↓

Arc payout

## Intelligent Contract Requirements

- Structured outputs
- Confidence score
- Multiple-source verification
- Retry on low confidence
- Refuse uncertain settlement

## Edge Cases

- Postponed matches
- Abandoned matches
- Suspended matches
- Extra time
- Penalty shootouts
- VAR corrections
- Walkovers
- Match replays
- Conflicting sources

## Cross-Chain Flow

GenLayer determines truth **and performs adjudication**. Any decision
that requires judgment, non-deterministic reasoning, natural-language
interpretation, or live web/LLM input must be produced by a GenLayer
Intelligent Contract — never approximated with ad hoc backend logic
(e.g. the backend must not call an LLM provider directly to "help"
decide a settlement outcome; that reasoning belongs in the Settlement
Intelligent Contract, where it goes through Optimistic Democracy
consensus across validators).

Backend validates the adjudication **decision** GenLayer already
produced — structural/schema checks, confidence-threshold checks,
duplicate-settlement checks — it does not re-derive or second-guess the
truth of the outcome itself.

Arc executes escrow release and payouts.

## Security

- Multi-source verification
- Immutable settlement records
- No duplicate settlements
- Validation before payouts

---

# 7. Arc Smart Contract Architecture

## Purpose

Arc Testnet is Wager's financial execution layer. All user funds remain
on Arc while GenLayer is responsible only for adjudication.

## Responsibilities

- Accept USDC deposits
- Lock funds in escrow
- Record positions
- Release payouts
- Process withdrawals
- Emit on-chain events

## Smart Contracts

### Escrow Contract

- Lock USDC
- Unlock after settlement
- Prevent double claims

### Market Contract

- Register positions
- Track market liquidity
- Link positions to canonical markets

### Rewards Contract

- Calculate winnings
- Process claims
- Record payout history

## Wallet & Payout Architecture (decided; binding for implementation)

**Wallet model**: Circle User-Controlled Wallets (embedded, non-custodial
— the user holds their own key via Circle's MPC/passkey flow, no seed
phrase). Wager's backend never has unilateral signing authority over
user funds. Confirmed free for MVP scale (first 1,000 Monthly Active
Wallets/month) and supported on Arc Testnet per Arc's own developer
documentation.

**Payout mechanics**: Pari-mutuel. Support and Challenge stakes form two
pools per market; losing-side stakes are redistributed to the winning
side proportional to stake, at settlement. No fixed odds are quoted at
prediction time.

**Settlement relayer**: A backend-held operator key, authorized on the
Escrow/Market contracts, calls the settlement function once GenLayer's
adjudication has been validated (confidence threshold, structural
checks, not-already-settled). This key never originates a decision —
only relays one GenLayer already reached consensus on, consistent with
§6.

**Gas**: Users pay their own (Arc's fees are fractions of a cent). No
gas sponsorship in the initial build.

**Not yet decided**: exact refund/void handling for postponed or
abandoned matches (likely full stake return), and whether a smart
contract audit is required before any mainnet consideration (Phase 6
lists a general "security review" — legal/regulatory review for
real-money pari-mutuel markets should be added to that phase's scope
alongside it).

## Cross-Chain Settlement

GenLayer Settlement Decision → Backend Verification → Arc Smart Contract
→ Escrow Release → User Balance Updated

## Security

- Signature verification
- Double-spend protection
- Reentrancy protection
- Input validation
- Event logging
- Immutable transaction history

## Acceptance Criteria

- Deposits succeed reliably
- Withdrawals only from available balance
- Escrow cannot be bypassed
- Duplicate claims prevented
- Every payout is traceable

---

# 8. Backend APIs & Real-time Specification

## API Principles

- RESTful endpoints
- Typed request and response models
- Zod validation
- Cursor pagination
- Friendly error messages
- Version-ready design

## Core APIs

Authentication - Sign up - Sign in - Session - Logout

Profile - Update profile - Username availability - Follow user -
Unfollow user

Feed - Get feed - Create prediction - Like - Repost - Comment

Markets - List markets - Market details - Support - Challenge -
Positions

Wallet - Deposit - Withdraw - Claim rewards - Transaction history

Notifications - List notifications - Mark as read

Search - Users - Matches - Markets

## Socket.IO Rooms

user:{id} market:{id} match:{id} post:{id}

## Real-time Events

- feed_update
- comment_added
- like_added
- repost_added
- follow_added
- odds_updated
- liquidity_updated
- score_updated
- settlement_completed
- notification_created

## Error Handling

Every API returns: - Success status - Human-readable message - Error
code (if applicable) - Structured data payload

Never expose raw blockchain or server errors.

## Acceptance Criteria

- Live updates require no page refresh.
- Automatic reconnection after disconnect.
- Optimistic UI for supported actions.
- API responses remain consistent across endpoints.

---

# 9. Implementation Roadmap

## Guiding Principle

Build Wager incrementally. Every milestone must compile successfully
before moving to the next. Do not start a dependent feature until its
prerequisites are complete.

## Phase 1 --- Foundation

- Initialize Next.js project
- Configure TypeScript
- Configure Tailwind CSS
- Install shadcn/ui
- Configure Prisma
- Connect PostgreSQL
- Configure authentication
- Configure Socket.IO
- Configure code quality tools

## Phase 2 --- User System

- Authentication
- Profile onboarding
- Username validation
- Profile pages
- Follow system

## Phase 3 --- Core Social Experience

- Discover feed
- Prediction creation
- Likes
- Comments
- Reposts
- Notifications
- Search

## Phase 4 --- Market Engine

- Fixture synchronization
- Canonical markets
- Market pages
- Support / Challenge
- Position tracking

## Phase 5 --- Wallet & Settlement

- USDC deposits
- Escrow
- Withdrawals
- Claims
- Settlement flow

## Phase 6 --- Production Readiness

- Performance optimization
- Accessibility review
- Security review
- Responsive testing
- Bug fixes
- Documentation update

## Definition of Done

A feature is complete only if:

- It satisfies its acceptance criteria.
- TypeScript passes.
- Lint passes.
- Build succeeds.
- Existing functionality is not broken.
- PROJECT_STATE.md is updated.

---

# 10. Security, Testing & Deployment

## Security Principles

- Validate all input.
- Never trust client-side data.
- Store secrets only in environment variables.
- Protect financial operations with server-side validation.
- Never expose private keys or sensitive credentials.

## Testing Strategy

### Unit Tests

- Utility functions
- Validation logic
- Reward calculations

### Integration Tests

- API endpoints
- Database operations
- Wallet flows
- Settlement pipeline

### End-to-End Tests

- User onboarding
- Prediction workflow
- Deposit
- Settlement
- Withdrawal

## Performance Requirements

- Fast initial page load
- Lazy loading where appropriate
- Cursor-based pagination
- Optimistic UI
- Image optimization
- Automatic Socket.IO reconnection

## Deployment

Frontend: - Vercel (Hobby)

Backend: - Vercel

Database: - Supabase PostgreSQL

Storage: - Supabase Storage

Blockchain: - GenLayer Bradbury Testnet - Arc Testnet

## Environment Variables

Organize variables into:

- Application
- Authentication
- Database
- GenLayer
- Arc
- Storage

## Monitoring

Track:

- API failures
- WebSocket failures
- Settlement failures
- Arc transaction failures
- Database errors

## Acceptance Criteria

- Successful production deployment.
- No critical security vulnerabilities.
- Stable real-time updates.
- Reliable settlement workflow.

---

# 11. AI Development Rules

## Purpose

This document governs how AI coding assistants (Claude, ChatGPT, Gemini,
etc.) must build and maintain Wager.

## General Rules

- Read `PROJECT.md` before every task.
- Read `PROJECT_STATE.md` before every task.
- Treat `PROJECT.md` as the single source of truth.
- Build only the requested feature.
- Never rewrite unrelated files.
- Never duplicate business logic.
- Reuse existing components whenever possible.
- Keep the codebase modular and maintainable.

## Coding Standards

- Strict TypeScript only.
- Avoid `any` unless absolutely necessary.
- Prefer Server Components.
- Keep Client Components minimal.
- Use shared utilities instead of duplicated code.
- Optimize for readability before cleverness.

## Debugging Workflow

When an error occurs:

1.  Identify the root cause.
2.  Fix the underlying issue instead of masking it.
3.  Verify the fix.
4.  Ensure no regressions.
5.  Update PROJECT_STATE.md if necessary.

## Documentation Rules

After every completed feature:

- Update PROJECT_STATE.md.
- Record modified files.
- Record known issues.
- Record the next recommended task.

## Context Management

When context becomes limited:

- Stop after completing the current feature.
- Update PROJECT_STATE.md.
- Summarize completed work.
- Recommend the next task.
- Do not leave partially implemented features.

## Definition of Done

A task is complete only when:

- Feature works as specified.
- Build passes.
- TypeScript passes.
- Lint passes.
- Responsive behaviour verified.
- Documentation updated.

---

# 12. Future Roadmap (Post-MVP)

## Vision

The MVP establishes Wager as a decentralized social football prediction
platform. Future releases will expand functionality while preserving the
core philosophy.

## Planned Features

### Social

- User mentions
- Hashtags
- Bookmarks
- Rich media
- Verified profiles

### Markets

- Additional football market types
- Multi-match predictions
- Tournament markets
- Season-long markets

### Wallet

- Mainnet support
- Additional supported assets
- Portfolio analytics
- Cross-chain deposits

### Notifications

- Push notifications
- Email notifications
- Market reminders

### AI Features

- Personalized market discovery
- Feed recommendations
- Match summaries
- User insights

### Infrastructure

- Horizontal scaling
- Background workers
- Analytics dashboard
- Admin moderation tools

## Mainnet Readiness

Before mainnet launch:

- Independent security review
- Smart contract audit
- Load testing
- Disaster recovery testing
- Monitoring and alerting
- Production incident playbooks

## Product Principles

Future features must never compromise:

- Canonical markets
- Decentralized adjudication
- Social-first experience
- Transparent settlement
- Simplicity
