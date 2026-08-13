# Wager

Social football prediction platform. Every post is a prediction, backed
by a canonical market. GenLayer adjudicates truth; Arc moves money.

See `PROJECT.md` for the full product and engineering specification, and
`PROJECT_STATE.md` for current build status.

## Stack

- Next.js (App Router) + React + TypeScript
- Tailwind CSS + shadcn/ui (base primitives hand-configured — see note below)
- Prisma + PostgreSQL
- Socket.IO (via a custom server, see `server.ts`)
- GenLayer Bradbury Testnet (fixture discovery, match monitoring, settlement)
- Arc Testnet (deposits, escrow, payouts, withdrawals) via Circle
  User-Controlled Wallets (embedded, non-custodial)

## Getting started

```bash
npm install          # also runs `prisma generate` via postinstall
cp .env.example .env # fill in real values — see categories inside
npm run db:push       # or `npm run db:migrate` once you have a real DB
npm run db:seed        # dev fixture data — see note below
npm run dev            # starts the custom Next.js + Socket.IO server
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script                 | Purpose                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| `npm run dev`          | Dev server (custom server.ts, Socket.IO attached)                  |
| `npm run build`        | Production build                                                   |
| `npm run start`        | Production server                                                  |
| `npm run lint`         | ESLint                                                             |
| `npm run typecheck`    | `tsc --noEmit`                                                     |
| `npm run format`       | Prettier (writes)                                                  |
| `npm run format:check` | Prettier (check only, used in CI)                                  |
| `npm run db:generate`  | Regenerate the Prisma client                                       |
| `npm run db:push`      | Push `prisma/schema.prisma` to the database (no migration history) |
| `npm run db:migrate`   | Create + apply a dev migration                                     |
| `npm run db:studio`    | Prisma Studio                                                      |
| `npm run db:seed`      | Insert dev fixture matches/markets (see note below)                |

## Notes for contributors

- **shadcn/ui was configured by hand.** The `shadcn` CLI needs to reach
  `ui.shadcn.com` to fetch component registries; in network-restricted
  environments that fails. `components.json` is already set up correctly,
  so `npx shadcn@latest add <component>` will work anywhere with normal
  internet access — it will drop new components straight into
  `src/components/ui/`.
- **`server.ts` wraps Next.js** instead of using the built-in `next dev` /
  `next start` because Socket.IO needs a persistent HTTP server. This
  works for local dev and any Node-hosted deployment. **Vercel serverless
  functions do not support long-lived WebSocket connections** — if Wager
  deploys to Vercel per PROJECT.md, the real-time layer will need either a
  separate long-running Socket.IO service (e.g. a small Railway/Fly/Render
  instance) or a swap to a serverless-friendly transport (e.g. Pusher,
  Ably, or Vercel's own realtime primitives). This is flagged as a
  pending decision in `PROJECT_STATE.md` — it does not block local
  development.
- **`genlayer/` is a separate Python project** containing Wager's
  Intelligent Contracts (GenLayer Bradbury Testnet). It has its own
  `requirements.txt`, tests, and README — see `genlayer/README.md` for
  setup, linting, testing, and deployment instructions. Once the
  Fixture Discovery and Match Monitoring contracts are deployed, set
  `GENLAYER_FIXTURE_DISCOVERY_CONTRACT_ADDRESS` and
  `GENLAYER_MATCH_MONITORING_CONTRACT_ADDRESS` in `.env`, then
  `prisma/seed.ts` (below) becomes unnecessary — the real sync paths
  are `POST /api/admin/sync-fixtures`
  (`src/lib/genlayer/sync-fixtures.ts`) and
  `POST /api/admin/sync-match-status`
  (`src/lib/genlayer/sync-match-status.ts`, which also reads each
  fixture's source URL from the Fixture Discovery contract).
- **`arc/` is a separate Foundry (Solidity) project** containing
  Wager's `Market`/`Escrow` contracts (Arc Testnet). It has its own
  `foundry.toml`, tests, and README — see `arc/README.md` for setup
  (including a sandbox-specific solc download workaround if you hit
  it), testing, and deployment instructions. Once deployed, set
  `ARC_MARKET_CONTRACT_ADDRESS`/`ARC_ESCROW_CONTRACT_ADDRESS`,
  `ARC_PRIVATE_KEY` (a funded relayer account), `CIRCLE_API_KEY`, and
  `NEXT_PUBLIC_CIRCLE_APP_ID` (from the Circle Developer Console) in
  `.env` — Support/Challenge staking (`/api/wallet/*`) won't function
  without all of these.
- **`prisma/seed.ts` is temporary.** It inserts a few dev-only Matches
  and their canonical `MATCH_RESULT` Markets so Discover Feed and
  Prediction creation are testable before GenLayer's Fixture Discovery
  Contract (Phase 4) exists. Delete it once that's live — nothing else
  should depend on it as a permanent data source.
- Financial state is authoritative on **Arc** — specifically, in the
  `Escrow` contract's own on-chain balance. The `Transaction` and
  `Position` Prisma models are a synced read-model/ledger for the app
  (written only after independently re-verifying an on-chain
  transaction — see `src/app/api/wallet/stake-confirm/route.ts`),
  never the source of truth for funds.
- **Supabase Storage bucket**: avatar uploads (`POST
/api/profile/avatar`) write to the bucket named by
  `SUPABASE_STORAGE_BUCKET` (default `wager-media`) and read back a
  `getPublicUrl()` link, so that bucket must be created and set to
  **public read** in your Supabase project before onboarding will work
  end to end. `SUPABASE_SERVICE_ROLE_KEY` is required server-side for
  the upload itself and must never be exposed to the client.
- This codebase targets **Next.js 16**, where Middleware is called
  **Proxy** (`src/proxy.ts`, not `middleware.ts` — functionality is
  identical, just renamed). Next's docs also now explicitly say Proxy
  should only do cookie/JWT-based checks, never database calls — which
  is why Auth.js's config here is split between `src/auth.config.ts`
  (edge-safe, used by Proxy) and `src/auth.ts` (full, Prisma + bcrypt,
  Node-runtime only). Keep that split when extending auth.
