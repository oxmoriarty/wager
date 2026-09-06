# Wager — Detected Issues & Resolution Log

This document provides a comprehensive technical log of all bugs, architecture challenges, UX flaws, and deployment issues detected and resolved in the **Wager** platform.

---

## 1. Vercel Build & Prisma Engine Resolution

### Issue
- Deployment to Vercel failed during build:
  - Deprecated `uuid` dependency warnings.
  - Prisma error `P1012: The datasource provider wasm is not supported` caused by Next.js resolving Prisma v7 preview binaries in the absence of a committed lockfile.

### Root Cause
- The repository was missing `package-lock.json` in Git. Vercel defaulted to downloading the latest `@prisma/client` and `prisma` packages (v7.x), which contained breaking changes and WebAssembly engine requirements inconsistent with Prisma v6 schema syntax.

### Resolution
- Pinned `@prisma/client` and `prisma` strictly to `^6.4.1` in `package.json`.
- Generated a clean `package-lock.json` locally and committed it to version control.
- Ensured Vercel's build pipeline uses deterministic dependency resolution.

---

## 2. TypeScript Compilation Errors on Contract Helper Scripts

### Issue
- Vercel build failed with TypeScript compilation errors in helper files located inside the `arc/` and `genlayer/` directories (specifically OpenZeppelin test helper scripts expecting hardhat/foundry environments).

### Root Cause
- Next.js's root `tsconfig.json` included all TypeScript files in the repository by default, attempting to compile standalone Solidity deployment and testing scripts as part of the Next.js frontend build.

### Resolution
- Updated `tsconfig.json` exclude patterns:
  ```json
  "exclude": ["node_modules", "arc", "genlayer"]
  ```
- This confines Next.js compilation strictly to application code in `src/` and `server.ts`.

---

## 3. Database Connection Exhaustion (Direct vs. Pooled Supabase URLs)

### Issue
- Serverless API routes threw:
  ```
  FATAL: (EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15
  ```
  and `PrismaClientInitializationError: Can't reach database server at db.xxxx.supabase.co:5432`.

### Root Cause
- Direct connections (`port 5432`) to Supabase bypass the connection pooler and are IPv6-only on standard tiers, causing connection failures in serverless environments with IPv4-only outbound routing or connection pooling limits.
- Furthermore, serverless functions opened individual sessions that rapidly exceeded Supabase's direct pool size limit.

### Resolution
- Configured dual connection strings in `prisma/schema.prisma`:
  ```prisma
  datasource db {
    provider  = "postgresql"
    url       = env("DATABASE_URL")
    directUrl = env("DIRECT_URL")
  }
  ```
- Set `DATABASE_URL` to Supabase's Transaction Pooler (`aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1`) for lightweight, high-concurrency runtime queries.
- Set `DIRECT_URL` to Session Pooler on port `5432` specifically for Prisma migrations and schema push operations (`prisma db push`).

---

## 4. Post-Creation Navigation & Post Composer Accessibility

### Issue
- After signing up and creating their first post (or entering a market), users could not find a way to create another post. They appeared trapped on the detail page or feed without an obvious compose button.

### Root Cause
- The `PredictionComposer` was statically embedded at the top of the feed (`/`). Once scrolled down, or once navigated to a prediction detail page (`/[username]/[predictionId]`), there was no global "New Post" / "Predict" action in the header or navigation bar, nor was there a return path to the feed from detail views.

### Resolution
- **Persistent Header Button**: Added a prominent **"Predict"** button (`PenLine` icon) in [`AppHeader`](file:///c:/Users/Engr%20sam/Documents/Dev/GenlayerDapps/wager/src/components/layout/app-header.tsx) visible across every page.
- **Sticky Floating Action Button (FAB)**: Added a floating action button on mobile and desktop pinned to the bottom right of the feed (`fixed right-5 bottom-6 z-50`).
- **Collapsible Composer**: Redesigned the composer on the home feed to default to a clean, non-intrusive trigger card (`"What's your prediction?"`) that expands upon click or when `?compose=true` is present in the URL.
- **Back Navigation**: Added a `← Back to feed` link on prediction detail pages to ensure seamless navigation back to the primary feed.

---

## 5. Threaded Comments & Nested Discussion System (Twitter-Style)

### Issue
- Comments were originally flat; users could not reply to comments made by others. There was no visual nesting to distinguish a direct post comment from a reply to a comment.

### Root Cause
- The `Comment` entity in `prisma/schema.prisma` had no self-referential `parentId` hierarchy. The query layer and UI assumed single-level comment arrays.

### Resolution
- **Database Schema**: Added self-relation to `Comment`:
  ```prisma
  parentId  String?
  parent    Comment?  @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies   Comment[] @relation("CommentReplies")
  ```
- **Prisma Schema Sync**: Synchronized the new column and index directly to the Supabase database via `prisma db push`.
- **Hierarchical Querying**: Updated `getCommentsPage` to fetch top-level comments (`parentId: null`) with ordered `replies` nested within each item.
- **Twitter-Style Visual Threading**:
  - Top-level comments display as standard cards.
  - Replies render nested beneath with an indented vertical thread line (`border-l-2 border-muted ml-8 pl-3`) and smaller avatars.
  - Every comment and reply features an inline **Reply** button.
  - Replying to a reply automatically tags `@username` and flattens into the root comment thread without erroring.
- **Contextual Notifications**:
  - Top-level comments trigger: `"{name} commented on your prediction."` sent to the post author.
  - Replies trigger: `"{name} replied to your comment."` sent to the comment author.

---

## 6. Wallet Requirement Gate on Market Side Selection (Support / Challenge)

### Issue
- Users without an Arc wallet could select "Support" or "Challenge" when posting, leading them to believe they had entered a financial market position without having USDC or an Arc wallet set up.
- Conversely, users without a wallet could not post regular thoughts or predictions if `side` was mandatory.

### Root Cause
- `side` was a required `PredictionSide` enum in `prisma/schema.prisma` and `createPredictionSchema`.
- The composer did not inspect the user's wallet status before allowing side selection.

### Resolution
- **Disabled State with Guidance**: In `PredictionComposer`, "Support" and "Challenge" buttons are disabled if the user has no wallet (`!hasWallet`), accompanied by an informative prompt: *"Set up your wallet to enter a market and stake USDC"* linking to `/wallet`.
- **Optional Side**: Changed `side` in `prisma/schema.prisma` and validation schema to `PredictionSide?` (nullable). Users without a wallet can now post their analysis and opinions freely without choosing a market side.
- **API Guard**: Added verification in `POST /api/predictions` ensuring that any request specifying a `side` must originate from an account with an initialized `arcWalletAddress`.

---

## 7. Circle Wallet Setup & PIN Recovery Failure

### Issue
- When attempting to set up an Arc wallet, users entered a 6-digit PIN and 2 security questions in the Circle modal, but received:
  ```
  "Something went wrong setting up your wallet. Please try again."
  ```
  Subsequent attempts continuously failed with the same error.

### Root Cause
- In Circle's User-Controlled Wallet SDK, once a user sets their PIN and security questions, calling `createUserPinWithWallets` again throws an error because the PIN already exists.
- If network latency or a page reload interrupted the subsequent `POST /api/wallet/setup-confirm` call, the user's `arcWalletAddress` was not saved in Prisma. When the user clicked "Set up wallet" again, `POST /api/wallet/init` blindly attempted to create a fresh setup challenge, which Circle rejected.

### Resolution
- **Automatic Recovery**: `POST /api/wallet/init` now calls `getArcWallet(userId)` *before* issuing any challenge. If Circle already has a wallet provisioned, the endpoint immediately persists `circleWalletId` and `arcWalletAddress` to the database and returns `hasWallet: true`.
- **Challenge Exception Recovery**: If `createWalletSetupChallenge` throws an error, the endpoint catches it and performs an additional check against `getArcWallet(userId)` before reporting failure.
- **Confirmation Polling**: In `POST /api/wallet/setup-confirm`, added polling (up to 3 attempts with 1.5s delay) to accommodate Circle's asynchronous on-chain wallet creation.
- **Client Resilience**: Added a 409 retry loop in `useWalletSetup.ts` before showing any error toast.

---

## 8. Follow / Follow Back & Unfollow Confirmation Modal

### Issue
- When visiting another user's profile, the follow button had no distinction between following someone first versus following them back.
- Clicking "Following" immediately unfollowed the user with no confirmation prompt.

### Root Cause
- Profile pages only checked whether the viewer followed the profile (`isFollowing`), without querying whether the profile owner followed the viewer (`isFollowingBack`).
- The button lacked a confirmation modal state.

### Resolution
- **Two-Way Relationship Query**: `src/app/[username]/page.tsx` queries both directions in parallel:
  - `isFollowing`: Does viewer follow profile?
  - `isFollowingBack`: Does profile owner follow viewer?
- **3-State Button UX**:
  - Displays **"Follow"** if neither follows.
  - Displays **"Follow Back"** if the profile owner already follows the viewer.
  - Displays **"Following"** if the viewer already follows them.
- **Unfollow Confirmation Modal**:
  - Clicking "Following" opens a centered modal with a dark backdrop (`bg-background/80 backdrop-blur-xs`).
  - Presents an explicit prompt: `"Unfollow @username?"` with **Cancel** and **Unfollow** buttons.

---

## 9. Inline Follow Back Button in Notifications

### Issue
- When a user received a notification that someone followed them, there was no quick way to follow them back from the notification list.

### Root Cause
- The notification item was wrapped entirely in a Next.js `<Link>` that navigated directly to the actor's profile, with no interactive follow actions.

### Resolution
- Updated `getNotificationsPage` in `src/lib/queries/notifications.ts` to include `actorId` and compute `isFollowingBack` for all `FOLLOW` type notifications.
- Created `FollowBackButton` inside `NotificationsList`:
  - Shows **"Following"** (disabled) if already following back.
  - Shows **"Follow Back"** if not yet following back.
  - Uses `e.stopPropagation()` and `e.preventDefault()` to execute the follow request without triggering page navigation.
  - Clicking outside the button on the notification card still navigates to the actor's profile.

---

## 10. Repost Once Enforcement

### Issue
- Users could trigger duplicate repost requests, causing redundant database queries and duplicate notification events.

### Root Cause
- While the `Repost` model had a `@@unique([userId, predictionId])` constraint in Prisma, the API route caught `P2002` errors and silently proceeded to emit socket events and dispatch duplicate notifications.

### Resolution
- **Strict Verification**: `POST /api/predictions/[id]/repost` checks whether a repost record already exists prior to insertion:
  ```ts
  const existing = await prisma.repost.findUnique({
    where: { userId_predictionId: { userId: session.user.id, predictionId: prediction.id } },
  });
  if (existing) {
    return apiError("You have already reposted this prediction. Undo your repost first to repost again.", 409, "ALREADY_REPOSTED");
  }
  ```
- **Toggle Support**: Users can undo their repost by clicking the active green repost button (invoking `DELETE`), which clears the repost and allows them to repost again if desired.

---

## 11. Client-Side Crash on Comment Creation ("This page couldn't load")

### Issue
- Whenever a user submitted a comment, the screen crashed with Next.js's production error boundary screen:
  ```
  This page couldn't load
  Reload to try again, or go back.
  [Reload] [Back]
  ```
  Refreshing the page in the browser temporarily resolved the issue and displayed the comment.

### Root Cause
- When comments or replies were returned from the API route (`/api/predictions/[id]/comments`), the `createdAt` timestamp was serialized as an ISO string (`"2026-09-06T01:35:00.000Z"`).
- `formatRelativeTime(date)` in `src/lib/format.ts` was typed strictly as `Date` and directly invoked `date.getTime()`. Calling `.getTime()` on a string threw an uncaught:
  ```
  TypeError: date.getTime is not a function
  ```
  This crashed the React component tree and triggered Next.js's top-level error boundary.
- Full browser reloads appeared to "fix" it because Server-Side Rendering passed actual JavaScript `Date` instances instantiated by the Prisma client.
- Additionally, `initials(name)` across several components did not guard against undefined or empty string values, throwing `TypeError: Cannot read properties of undefined (reading 'trim')`.
- `POST /api/predictions/[id]/comments` returned `{ ...commentRaw, author: ... }` omitting the `replies: []` property, which caused nested mapping exceptions.

### Resolution
- **Resilient Date Formatting**: Updated `formatRelativeTime` and `formatKickoff` in `src/lib/format.ts` to accept `Date | string | number | null | undefined`:
  ```ts
  export function formatRelativeTime(date: Date | string | number | null | undefined) {
    if (!date) return "";
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return "";
    const seconds = Math.round((Date.now() - d.getTime()) / 1000);
    // ...
  }
  ```
- **Null-Safe String Helpers**: Updated `initials(name?: string | null)` across all UI components (`app-header.tsx`, `prediction-card.tsx`, `comment-list.tsx`, `notifications-list.tsx`, `onboarding-form.tsx`) to return `"?"` when values are missing.
- **State Synchronization**: Added an effect in `CommentList` syncing state whenever `initialPage.items` updates, and connected WebSocket `comment_added` listeners to automatically reload fresh comments without manual page refresh.
- **Complete Payload Shape**: Added `replies: []` to the comment creation return object in `POST /api/predictions/[id]/comments`.

---

## 12. Conversation Thread Timeline & Relocated Comment Composer

### Issue
- Comments and replies were displayed as isolated, disconnected card blocks with excessive padding, heavy margins, and stepped indents that broke visual conversation continuity.
- The comment composer box was positioned awkwardly between the prediction post and the comments section, rather than below the discussion stream.

### Resolution
- **Connected Vertical Timeline**:
  - Replaced isolated card containers with a unified conversation thread layout where parent comments and replies share a single vertical alignment axis.
  - Implemented continuous vertical connector lines (`w-0.5 bg-border`) linking parent avatars directly to subsequent reply avatars, with lines neatly masked behind solid circular avatars (`relative z-10 bg-background ring-4 ring-background`).
  - Terminal connector segments terminate cleanly within the final reply's avatar, ensuring no dangling lines.
- **Thread Separation**:
  - Divided distinct root conversation threads using subtle horizontal border dividers (`divide-y divide-border/60`), eliminating bulky card shadows.
- **Inline Reply Experience**:
  - Connected the inline `ReplyComposer` directly into the thread timeline, displaying the active user's avatar in column alignment and automatically linking to the parent discussion.
- **Relocated Primary Composer**:
  - Moved `CommentComposer` below all comments in `src/app/[username]/[predictionId]/page.tsx`, so readers encounter the conversation thread first and can reply at the bottom of the discussion.
  - Enhanced the composer with current user avatar display, borderless clean textarea, character count, and instantaneous client-side event dispatch (`wager:comment_added`).

---

## 13. Tree-Structured Threaded Replies, Branch Connectors, Collapsible Conversations & Comment Likes

### Issue
- The comment system lacked true multi-level recursive reply trees, as previous backend handlers flattened all sub-replies directly into 1-level roots.
- Users could not target and reply to a specific comment in a nested discussion branch (`parentReplyId` was lost).
- Visual hierarchy lacked tree branch connectors (`├─`, `└─`, `│`), making deep discussions difficult to follow.
- Deep branches with multiple replies overwhelmed screen space without collapse controls.
- Comments lacked like interactions (`♡`), unlike prediction posts.
- Prediction posts on the detail view did not display market probability odds (`YES % / NO %`).

### Resolution
- **True Recursive Data Model & Query Layer**:
  - Maintained exact parent-child relations without flattening: `targetParentId = parent.id` in `POST /api/predictions/[id]/comments`.
  - Built an in-memory recursive tree builder in `src/lib/queries/comments.ts` yielding `CommentNode` trees with arbitrary depth.
  - Implemented `parentReplyId` validation and targeted author notifications.
- **Tree Branch Connector UI**:
  - Implemented branch connectors (`├─` for intermediate siblings and `└─` for terminal siblings) with continuous vertical spines (`│`).
  - Capped visual indentation at depth 2 (`ml-4 sm:ml-6`) to prevent text squishing on mobile devices.
- **Collapsible Deep Conversations**:
  - Added collapsible branch toggles (`└─ X more replies`) for branches with multiple replies, with smooth expand and collapse controls.
- **Comment Likes System**:
  - Added `CommentLike` model in Prisma and synchronized with Supabase PostgreSQL (`npx prisma db push`).
  - Added `POST` and `DELETE` endpoints at `/api/comments/[id]/like` with optimistic UI toggles (`♡` / `♥`).
- **Contextual Reply Composer**:
  - Positioned the primary composer beneath the prediction post, supporting contextual replying with `Replying to @username` and `✕ Cancel` actions.
- **Market Probability & Odds Bar**:
  - Added a visual YES/NO and Support/Challenge percentage split bar on `PredictionCard` derived from live pool liquidity.
- **Cohesive Conversation View**:
  - Created `ConversationView` to unify the composer, tree, sorting modes (Conversational / Latest / Top Liked), and real-time socket updates in-place without page reloads.

---

## 14. Fixed-Bottom Expandable Comment Composer

### Issue
- The comment composer box was placed between the prediction post and comments, cluttering the top of the conversation view and moving away as the page was scrolled.
- Users had to scroll past the composer to see discussion threads, or scroll all the way back up to reply.
- When fixed to the bottom, static composers took up significant vertical screen space on mobile devices.

### Resolution
- **Reordered Hierarchy**: Placed the comments tree (`CommentList`) immediately beneath the prediction post so users encounter the conversation directly without interruption.
- **Fixed Bottom Positioning**: Styled `CommentComposer` with `fixed bottom-0 left-0 right-0 z-40` and pointer-events layering so it stays anchored at the bottom of the viewport during scrolling.
- **Progressive Disclosure & Dynamic Expand/Collapse**:
  - **Compact Initial State**: Defaults to a sleek, low-height pill bar (~44px) with the user avatar, placeholder ("Post your reply…"), and a compact "Reply" button.
  - **Expanded Active State**: When clicked or focused (or when replying to a specific user in the tree), the bar expands smoothly into a full-height composer displaying the "Replying to @username" chip, multi-line auto-focusing textarea, character counter (`0/500`), "Cancel" button, and submit button.
  - **Smart Collapse**: Automatically collapses back to compact mode on cancel or when the user clicks outside without entering text.
- **Viewport & Safe Area Protection**:
  - Added safe area inset padding (`pb-[max(0.75rem,env(safe-area-inset-bottom))]`) for iOS mobile home bars.
  - Added bottom padding (`pb-28 sm:pb-32`) to the conversation container so the last comments in the tree and pagination controls are never obscured behind the floating bottom bar.
  - Rendered a smooth upward gradient backdrop fade (`h-28 bg-gradient-to-t from-background via-background/85 to-transparent`) behind the bar for seamless contrast.

---

## 15. Comment Count Header Removal, Bottom-Right Post Filter Controls & Post Link Sharing

### Issue
- An intermediate bar displaying comment count (`💬 6 Comments`) and sorting buttons was positioned between the post card and comments tree, breaking the visual connection from the prediction card into the threaded conversation.
- Users had no direct way to copy and share a link to a prediction post from cards on the feed or detail pages.

### Resolution
- **Removed Intermediate Header Bar**:
  - Eliminated the redundant comment count header and border divider between the prediction post and comments tree in `CommentList`.
  - The vertical conversation connector line now flows uninterrupted directly from the bottom of the prediction post into the threaded reply tree.
- **Relocated Filter Controls to Post Box Bottom Right**:
  - Integrated `Oldest`, `Latest`, and `Top Liked` sorting buttons directly into the bottom right of `PredictionCard`.
  - Positioned flexibly with `flex-wrap items-center justify-between` and `ml-auto` so action icons remain left-aligned and sort buttons anchor neatly to the right.
  - Linked post-level comment counter (`💬 {count}`) reactively to live conversation updates (`commentsCountOverride`).
- **Post Link Share Icon (`ShareButton`)**:
  - Added a dedicated `ShareButton` beside the repost button across all `PredictionCard` instances.
  - Implemented one-click clipboard copying with fallback for non-secure contexts (`navigator.clipboard` and `document.execCommand`).
  - Swaps the `Share` icon with a `Check` icon for 2 seconds and triggers an instant toast notification: `Post link copied to clipboard!`.

---

## Verification & Deployment Summary

| Check | Tool / Command | Result |
|---|---|---|
| **TypeScript Compilation** | `npx tsc --noEmit` | **0 errors** across all files |
| **Next.js Production Build** | `npm run build` | **All routes compiled cleanly** (Turbopack + static generation) |
| **Database Synchronization** | `npx prisma db push` | Synced with Supabase PostgreSQL (models: CommentLike, Comment, Prediction) |
| **Version Control** | `git push origin main` | Pushed to `oxmoriarty/wager` |


