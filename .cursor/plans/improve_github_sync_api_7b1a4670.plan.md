---
name: Improve GitHub Sync API
overview: "The bit app's GitHub sync has several architectural weaknesses compared to fastergh that cause incomplete and unreliable data syncing. This plan addresses the critical gaps: no deduplication on re-sync, no incremental sync, fire-and-forget execution without retries, limited initial sync scope, and broken webhook auto-tracking."
todos:
  - id: fix-dedup-pr-details
    content: Fix deduplication for PR files, comments, and commits in fetchPullRequestDetails() - query by githubId before inserting
    status: completed
  - id: fix-dedup-tree
    content: Fix tree entry deduplication in fetchRepoTree() - query by ref+path+repoId, delete stale entries
    status: completed
  - id: impl-find-user-by-sender
    content: Implement findUserBySender() in webhooks/utils.ts to query $users by githubId
    status: completed
  - id: staleness-protection
    content: Add githubUpdatedAt comparison before overwriting records; add syncedAt freshness check to skip redundant syncs
    status: completed
  - id: rate-limit-backoff
    content: Add retry helper for 429/403 responses with exponential backoff
    status: completed
  - id: tracked-sync-jobs
    content: Replace fire-and-forget sync with per-step error tracking and resumable progress
    status: completed
  - id: chunked-pagination
    content: Replace octokit.paginate() with chunked fetching for PRs/issues (5 pages per chunk, write between chunks)
    status: completed
  - id: remove-10-repo-limit
    content: Remove slice(0,10) limit, sort repos by activity, sync all with rate limit awareness
    status: completed
  - id: on-demand-pr-sync
    content: Add lazy PR detail sync triggered when user navigates to PR detail page
    status: completed
  - id: webhook-dedup
    content: Store X-GitHub-Delivery header, skip duplicate webhook deliveries
    status: completed
  - id: webhook-error-recovery
    content: Store failed webhook payloads, add retry endpoint
    status: completed
  - id: token-auth-error-detection
    content: Add isGitHubAuthError() utility and handleGitHubAuthError() to invalidate stored token on 401
    status: completed
  - id: sync-routes-401-handling
    content: Handle 401 in all sync API routes — return specific auth_invalid error code instead of generic 500
    status: completed
  - id: frontend-reconnect-prompt
    content: Detect auth_invalid errors on frontend and show "Reconnect GitHub" prompt with re-auth flow
    status: completed
isProject: false
---

# Improve GitHub Sync API

## Diagnosis: Why Sync Isn't Working Correctly

After comparing the bit sync implementation (`[src/lib/github-client.ts](src/lib/github-client.ts)`) against fastergh's sync architecture (`packages/database/convex/rpc/`), here are the root causes:

### Critical Bugs

1. **PR files/comments are duplicated on every sync** -- `fetchPullRequestDetails()` always generates a new `id()` for files and comments instead of upserting by `githubId`. Every re-sync of a PR creates duplicate file, comment, and commit records. Reviews are correctly deduplicated (lines 519-525), but files (line 484), issue comments (line 556), review comments (line 597), and commits (line 635) are not.
2. **Tree entries are duplicated on every sync** -- `fetchRepoTree()` (line 701) always generates a new `id()` per tree entry. Re-syncing a tree doubles the entries.
3. `**findUserBySender()` is a stub returning `null` -- (`[src/lib/webhooks/utils.ts:12-18](src/lib/webhooks/utils.ts)`) means webhook auto-tracking never works. Every webhook for an untracked repo is silently dropped.
4. **Fire-and-forget sync with no error recovery** -- The overview sync endpoint (`[src/routes/api/github/sync/overview.ts:29](src/routes/api/github/sync/overview.ts)`) calls `performInitialSync().catch(console.error)` and returns immediately. If the sync fails midway (rate limit, network error), there is no retry and the user has no way to know what failed or resume.

### Architectural Gaps vs fastergh

| Aspect                  | fastergh                                                                                        | bit                                                    | Impact                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| **Deduplication**       | All upserts keyed by GitHub ID                                                                  | Files, comments, commits use `id()` every time         | Duplicate records on re-sync                                         |
| **Incremental sync**    | Webhook pipeline + out-of-order protection (`githubUpdatedAt >= existing`)                      | Full re-fetch every time, no staleness check           | Wastes API quota, overwrites newer webhook data with stale sync data |
| **Retry/durability**    | Durable workflow engine (8 retries, exponential backoff); webhook dead-letter queue (5 retries) | Fire-and-forget promise; no retry                      | Sync silently fails on transient errors                              |
| **Chunked pagination**  | PRs/issues fetched in 10-page chunks; each chunk is a durable step                              | `octokit.paginate()` fetches ALL pages in one call     | Timeouts on large repos; all-or-nothing failure                      |
| **Rate limit handling** | Detects 429/403, calculates `retryAfterMs`, retries automatically                               | Tracks rate limit headers but never acts on them       | Sync fails when rate limited                                         |
| **Initial sync scope**  | All repos bootstrapped (queued with priority by stars)                                          | Only first 10 repos get PR sync                        | Most repos never get PRs synced                                      |
| **Webhook processing**  | Ingestion + dedup by deliveryId, cron-based batch processing, retry queue                       | Inline processing in request handler                   | Duplicate processing possible; no retry on failure                   |
| **CI/check data**       | Syncs check runs, workflow runs, workflow jobs                                                  | Not synced                                             | Missing CI status on PRs                                             |
| **User tracking**       | Collects and upserts GitHub users from every API response                                       | Stores `authorLogin`/`authorAvatarUrl` as flat strings | No user entity, can't cross-reference reviewers/assignees            |
| **Token management**    | OAuth with automatic refresh (5-min expiry buffer)                                              | Token stored in `syncStates.lastEtag`, no refresh      | Token expires silently, all syncs fail                               |

---

## Commit Strategy

Each phase (and sometimes sub-step) will be committed separately so progress is incremental and reviewable. Planned commits:

- **Phase 1.1** -- `fix: deduplicate PR files, comments, and commits on re-sync`
- **Phase 1.2** -- `fix: deduplicate tree entries on re-sync`
- **Phase 1.3** -- `fix: implement findUserBySender for webhook auto-tracking`
- **Phase 2** -- `fix: add staleness protection to prevent overwriting newer data`
- **Phase 3.1** -- `feat: add rate limit backoff with automatic retry`
- **Phase 3.2 + 3.3** -- `feat: tracked sync jobs with chunked pagination`
- **Phase 4** -- `feat: expand sync scope and add on-demand PR detail sync`
- **Phase 4.5** -- `fix: detect expired GitHub tokens and prompt user to reconnect`
- **Phase 5** (if done) -- `feat: harden webhook pipeline with dedup and error recovery`

Each commit will be made after verifying the changes don't introduce linter errors and the code is formatted with `bun run format`.

## Plan

### Phase 1: Fix Critical Bugs

#### 1.1 Fix deduplication for PR files, comments, and commits

In `[src/lib/github-client.ts](src/lib/github-client.ts)`, change `fetchPullRequestDetails()` to query for existing records by `githubId` before inserting -- the same pattern already used for PRs (line 373) and reviews (line 519).

- **PR files** (line 483-506): Query `prFiles` by `{ sha, filename, pullRequestId }` before inserting
- **Issue comments** (line 555-579): Query `prComments` by `{ githubId }` before inserting
- **Review comments** (line 592-624): Query `prComments` by `{ githubId }` before inserting
- **Commits** (line 634-660): Query `prCommits` by `{ sha, pullRequestId }` before inserting

#### 1.2 Fix tree entry deduplication

In `fetchRepoTree()` (line 696-721): Query `repoTrees` by `{ ref, path, repoId }` before inserting. Also delete stale entries that no longer exist in the tree response.

#### 1.3 Implement `findUserBySender()`

In `[src/lib/webhooks/utils.ts](src/lib/webhooks/utils.ts)`: Query the `$users` table by `githubId` field (the user schema already has `githubId`). This unblocks webhook auto-tracking for registered users.

### Phase 2: Add Staleness Protection

#### 2.1 Skip updates when webhook data is newer

Before overwriting any record during sync, compare `githubUpdatedAt` on the existing record with the incoming data. Skip the update if the existing record is newer. This prevents a slow full-sync from overwriting recent webhook updates.

Apply to: `fetchPullRequests()`, `fetchPullRequestDetails()`, and all webhook handlers.

#### 2.2 Add `syncedAt` freshness check

Before starting a per-repo sync, check `syncedAt` on the repo record. If it was synced within the last N minutes (configurable, e.g. 5 min), skip the sync. This prevents redundant API calls when the user clicks "Sync" repeatedly.

### Phase 3: Improve Reliability

#### 3.1 Add rate limit backoff

In `[src/lib/github-client.ts](src/lib/github-client.ts)`, wrap API calls with a retry helper that:

- Catches HTTP 429 and 403 with `x-ratelimit-remaining: 0`
- Reads `retry-after` or `x-ratelimit-reset` headers
- Waits and retries (max 3 attempts)

This is a small utility function wrapping Octokit calls -- fastergh's approach in `githubApi.ts` is a good reference.

#### 3.2 Replace fire-and-forget with tracked sync jobs

Instead of `performInitialSync().catch(console.error)`, track sync progress properly:

- The sync is already writing progress to `syncStates` via `updateInitialSyncProgress()` -- this is good
- Add per-step error tracking: if a step fails, record which step failed and allow the retry endpoint to resume from that step
- Return the sync state ID to the client so it can poll for progress

#### 3.3 Add chunked pagination for large repos

Replace `octokit.paginate()` (which fetches ALL pages) with a chunked approach for PRs and issues:

- Fetch N pages at a time (e.g. 5 pages = 500 items)
- Write each chunk to the database before fetching the next
- If a chunk fails, the previously written chunks are preserved

### Phase 4: Expand Sync Scope

#### 4.1 Remove the 10-repo limit on initial sync

In `performInitialSync()` (line 977), the `slice(0, 10)` artificially limits PR syncing to 10 repos. Replace with a priority queue approach:

- Sort repos by `githubPushedAt` descending (most recently active first)
- Sync all repos, but respect rate limits using the backoff from 3.1
- If rate limited, pause and resume later rather than stopping

#### 4.2 Add on-demand PR detail sync

Following fastergh's on-demand sync pattern: when a user navigates to a PR detail page, trigger `fetchPullRequestDetails()` if the PR hasn't been synced recently. This lazy-loads detailed data only when needed, reducing initial sync time.

### Phase 4.5: Token Recovery & Auth Error Handling

**Problem**: When a GitHub token becomes invalid (user revokes it, GitHub invalidates it, token corruption), every sync call fails with a 401 "Bad credentials" error. This error is caught generically and returned as a 500 "Internal server error" — the user has no way to know their token is bad or to recover.

**Root cause**: The `createGitHubClient()` factory retrieves the stored token from `syncStates.lastEtag` but never validates it. When Octokit throws a 401 `RequestError`, no route handler distinguishes it from other errors. The token stays in the database, so every subsequent call fails the same way.

#### 4.5.1 Add `isGitHubAuthError()` + `handleGitHubAuthError()` utilities

In `src/lib/github-client.ts`:

- `isGitHubAuthError(error)` — checks if an error is an Octokit `RequestError` with `status === 401`
- `handleGitHubAuthError(userId)` — marks the stored token as invalid by setting `syncStatus: "auth_invalid"` on the `github:token` sync state record. Does NOT delete the token (in case it's a transient GitHub issue), but flags it so the frontend can prompt re-auth.

#### 4.5.2 Handle 401 in all sync API routes

In every route under `src/routes/api/github/sync/`, add a check in the catch block:

```typescript
if (isGitHubAuthError(error)) {
  await handleGitHubAuthError(userId)
  return jsonResponse({
    error: "GitHub authentication expired",
    code: "auth_invalid",
    details: "Your GitHub token is no longer valid. Please reconnect your GitHub account.",
  }, 401)
}
```

Apply to: `retry.ts`, `overview.ts`, `$owner.$repo.ts`, `$owner.$repo.pull.$number.ts`, `$owner.$repo.tree.ts`, `$owner.$repo.issue.$number.ts`.

Also add a 401 check in `createGitHubClient()` itself — after retrieving the token, check if `syncStatus === "auth_invalid"` on the token record and return `null` early with a specific reason, so the caller can distinguish "no token" from "token is known-bad".

#### 4.5.3 Frontend: detect auth errors and show reconnect prompt

In `src/routes/index.tsx`:

- In `handleSync()`, `handleRetrySync()`, and `handleResetSync()`: check if the response has `code: "auth_invalid"` and set a specific `authError` state
- Also derive `authError` from `syncStates` — if the `github:token` sync state has `syncStatus === "auth_invalid"`, the token is known-bad
- In `OverviewHeader`: when `authError` is true, replace the "Sync GitHub" button with a "Reconnect GitHub" button that triggers the OAuth flow
- Show a banner: "Your GitHub connection has expired. Please reconnect to continue syncing."

This gives users a clear recovery path instead of a cryptic "Internal server error".

#### Commit

- **Phase 4.5** — `fix: detect expired GitHub tokens and prompt user to reconnect`

### Phase 5: Harden Webhook Pipeline (Optional, Lower Priority)

#### 5.1 Add webhook deduplication by delivery ID

Store the `X-GitHub-Delivery` header value and skip duplicate deliveries. GitHub can retry webhook delivery, causing duplicate processing.

#### 5.2 Add webhook error recovery

When a webhook handler fails, store the raw payload in a `webhookFailures` table. Add a retry endpoint that re-processes failed webhooks.

---

## Files to Modify

| File                                                                                                                   | Changes                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[src/lib/github-client.ts](src/lib/github-client.ts)`                                                                 | Fix dedup, add rate limit backoff, chunked pagination, remove 10-repo limit, staleness checks, add `isGitHubAuthError()` + `handleGitHubAuthError()`, check token validity in `createGitHubClient()` |
| `[src/lib/webhooks/utils.ts](src/lib/webhooks/utils.ts)`                                                               | Implement `findUserBySender()`                                                                                                                                                                       |
| `[src/routes/api/github/sync/overview.ts](src/routes/api/github/sync/overview.ts)`                                     | Return sync state ID, improve error handling, add 401 auth error handling                                                                                                                            |
| `[src/routes/api/github/sync/retry.ts](src/routes/api/github/sync/retry.ts)`                                           | Add 401 auth error handling with `isGitHubAuthError()`                                                                                                                                               |
| `[src/routes/api/github/sync/$owner.$repo.ts](src/routes/api/github/sync/$owner.$repo.ts)`                             | Add 401 auth error handling                                                                                                                                                                          |
| `[src/routes/api/github/sync/$owner.$repo.pull.$number.ts](src/routes/api/github/sync/$owner.$repo.pull.$number.ts)`   | Add 401 auth error handling                                                                                                                                                                          |
| `[src/routes/api/github/sync/$owner.$repo.tree.ts](src/routes/api/github/sync/$owner.$repo.tree.ts)`                   | Add 401 auth error handling                                                                                                                                                                          |
| `[src/routes/api/github/sync/$owner.$repo.issue.$number.ts](src/routes/api/github/sync/$owner.$repo.issue.$number.ts)` | Add 401 auth error handling                                                                                                                                                                          |
| `[src/routes/index.tsx](src/routes/index.tsx)`                                                                         | Detect `auth_invalid` errors, derive auth state from syncStates, set `authError` state                                                                                                               |
| `[src/features/overview/OverviewHeader.tsx](src/features/overview/OverviewHeader.tsx)`                                 | Show "Reconnect GitHub" button + banner when auth is invalid                                                                                                                                         |
| `[src/routes/api/github/webhook.ts](src/routes/api/github/webhook.ts)`                                                 | Add delivery ID dedup                                                                                                                                                                                |
| `[src/instant.schema.ts](src/instant.schema.ts)`                                                                       | Add `webhookDeliveries` entity (if doing 5.1)                                                                                                                                                        |
