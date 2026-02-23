---
name: fastergh-adoption-roadmap
overview: "Repo-validated roadmap for adopting key FasterGH patterns in Bit: async webhook processing, queue retries/dead-lettering, CI/CD webhook coverage, schema-backed sync jobs, and stronger validation/error handling. Each task includes mandatory coverage + lint + format checks before commit."
todos:
  - id: webhook-queue
    content: Add webhookQueue and async processor (ingest fast, process later)
    status: pending
  - id: webhook-retry-dlq
    content: Add retry/backoff/dead-letter workflow for queued webhook processing
    status: pending
  - id: ci-cd-webhooks
    content: Implement check_run/check_suite/status/workflow_job/workflow_run handlers and persistence
    status: pending
  - id: schema-validation-errors
    content: Add runtime webhook validation, typed rate-limit errors, and lenient decoding
    status: pending
  - id: sync-jobs
    content: Add syncJobs queue with step/progress tracking for observable sync
    status: pending
  - id: ops-visibility
    content: Add structured logging and queue health endpoints for operations
    status: pending
  - id: integration-tests
    content: Add integration tests for idempotency, ordering, retry, and queue invariants
    status: pending
isProject: false
---

# FasterGH Adoption Roadmap for Bit

## Current Repo Baseline (validated)

- `src/routes/api/github/webhook.ts` still processes webhooks synchronously.
- `webhookDeliveries` already exists in `src/instant.schema.ts` with `processed|failed`, payload capture, and dedupe by `deliveryId`.
- `issues` and `issue_comment` are now implemented; old parity gap is mostly closed.
- CI/CD webhook events (`check_run`, `check_suite`, `status`, `workflow_job`, `workflow_run`) are still stubs.
- Project quality commands are available and should be mandatory before each task commit:
  - `bun run test:coverage`
  - `bun run lint`
  - `bun run format`
  - `bun run format:check`

---

## Working Agreement for This Plan

Every task in this roadmap follows the same required completion gate.

### Required Before Commit (each task)

1. Add/update tests for changed behavior.
2. Run coverage: `bun run test:coverage`.
3. Run lint: `bun run lint`.
4. Run formatter: `bun run format`.
5. Verify formatting clean: `bun run format:check`.
6. Commit only after all five steps pass.

If coverage runtime is too long locally, use scoped coverage while iterating, then run full `bun run test:coverage` before the final commit of that task.

---

## Priority Order

1. Async webhook queue + processor foundation
2. Retry/backoff/dead-letter reliability
3. CI/CD webhook feature completeness
4. Validation + typed errors + lenient decoding
5. Sync job queue with progress visibility
6. Operational visibility endpoints/logging
7. Integration coverage hardening

---

## Task 1: Async Webhook Queue Foundation

### Goal

Decouple webhook receipt from webhook processing so HTTP response is fast and processing is resilient.

### Scope

- Add `webhookQueue` entity in `src/instant.schema.ts`.
- Update `src/routes/api/github/webhook.ts` to:
  - validate signature + dedupe early,
  - enqueue work item,
  - return `200` quickly.
- Create queue processor module (suggested: `src/lib/webhooks/processor.ts`) that executes existing handler routing logic.
- Keep `webhookDeliveries` as the delivery ledger; queue item is the processing state.

### Tests to Add/Update

- `src/routes/api/github/webhook.test.ts`
  - enqueue-on-receive path
  - duplicate delivery short-circuit
  - fast 200 response behavior
- New processor tests (suggested: `src/lib/webhooks/processor.test.ts`)
  - dispatches to correct handler by event
  - marks success/failure status correctly

### Before Commit

- `bun run test:coverage`
- `bun run lint`
- `bun run format`
- `bun run format:check`

---

## Task 2: Retry, Backoff, and Dead-Letter

### Goal

Make webhook failures self-healing and observable without manual retries for common transient issues.

### Scope

- Extend `webhookQueue` with retry metadata:
  - `attempts`, `nextRetryAt`, `lastError`, `failedAt`, `processedAt`.
- Add exponential backoff + jitter strategy.
- Add terminal dead-letter status after max attempts.
- Add small worker trigger path (cron/timer/endpoint) to process due queue items.

### Tests to Add/Update

- Processor retry behavior:
  - retries transient failures
  - respects `nextRetryAt`
  - transitions to dead-letter on max attempts
- Idempotency test:
  - same delivery processed once even across retries

### Before Commit

- `bun run test:coverage`
- `bun run lint`
- `bun run format`
- `bun run format:check`

---

## Task 3: CI/CD Webhook Completeness

### Goal

Replace current CI/CD webhook stubs with persisted state that can be surfaced in PR views.

### Scope

- Implement handlers for:
  - `check_run`
  - `check_suite`
  - `status`
  - `workflow_job`
  - `workflow_run`
- Add schema entity for status/check records (name to decide during implementation, e.g. `prChecks`).
- Wire webhook switch in `src/routes/api/github/webhook.ts` to real handlers.
- Ensure idempotent updates keyed by GitHub IDs + repo/sha context.

### Tests to Add/Update

- `src/routes/api/github/webhook.test.ts` event-specific cases.
- New handler tests under `src/lib/webhooks/` for each CI/CD event type.
- Regression test that unknown events do not break processing.

### Before Commit

- `bun run test:coverage`
- `bun run lint`
- `bun run format`
- `bun run format:check`

---

## Task 4: Validation, Typed Errors, Lenient Decoding

### Goal

Reduce runtime crashes and improve user-facing retry behavior.

### Scope

- Add runtime payload validation at webhook boundaries using `zod` (already installed).
- Introduce typed rate limit error shape (`GitHubRateLimitError` + `retryAfterMs`) in GitHub client path.
- Add lenient list decoding helper for sync endpoints so malformed items are skipped and logged instead of failing whole sync.

### Tests to Add/Update

- Validation rejects malformed payloads without crashing queue worker.
- Typed rate-limit errors include `retryAfterMs` and are distinguishable from generic errors.
- Lenient decoding returns `{ parsed, skipped }` style behavior.

### Before Commit

- `bun run test:coverage`
- `bun run lint`
- `bun run format`
- `bun run format:check`

---

## Task 5: Sync Jobs Queue and Progress Tracking

### Goal

Move sync execution into explicit jobs with step-level visibility for users and operators.

### Scope

- Add `syncJobs` entity to `src/instant.schema.ts` with:
  - `jobType`, `resourceType`, `resourceId`, `state`, `priority`, `nextRunAt`,
  - `currentStep`, `completedSteps`, `itemsFetched`, `attempts`, `error`.
- Migrate key sync flows from direct execution to queued job execution.
- Keep `syncStates` for high-level status, but source progress from jobs.

### Tests to Add/Update

- `src/lib/sync-state.test.ts` and related sync tests for:
  - job lifecycle transitions
  - progress updates
  - retry semantics for failed steps

### Before Commit

- `bun run test:coverage`
- `bun run lint`
- `bun run format`
- `bun run format:check`

---

## Task 6: Operational Visibility

### Goal

Expose health and queue insight for debugging and support.

### Scope

- Add structured logs for webhook and queue processing:
  - `event`, `deliveryId`, `attempt`, `durationMs`, `status`, `error`.
- Add admin/health API endpoint(s) for:
  - queue depth by state,
  - oldest pending age,
  - failure/dead-letter counts,
  - last successful processing timestamp.

### Tests to Add/Update

- Route tests for health endpoint response shape and access control.
- Processor tests asserting status transitions are reflected in queryable fields.

### Before Commit

- `bun run test:coverage`
- `bun run lint`
- `bun run format`
- `bun run format:check`

---

## Task 7: Integration Coverage Hardening

### Goal

Lock in queue + webhook invariants with durable integration coverage.

### Scope

- Add/expand integration tests covering:
  - duplicate delivery idempotency,
  - out-of-order event handling,
  - retry with eventual success,
  - dead-letter after max attempts,
  - CI/CD event persistence path.
- Prefer route-level tests for `src/routes/api/github/*.test.ts` plus focused processor unit tests.

### Before Commit

- `bun run test:coverage`
- `bun run lint`
- `bun run format`
- `bun run format:check`

---

## First Files to Target

- `src/routes/api/github/webhook.ts`
- `src/lib/webhooks/index.ts`
- `src/lib/webhooks/*.ts` (new CI/CD + processor modules)
- `src/lib/sync-state.ts`
- `src/instant.schema.ts`
- `src/routes/api/github/*.test.ts`
- `src/lib/*.test.ts`

---

## Success Criteria

- Webhook intake is fast and no longer coupled to full processing latency.
- Retry/backoff/dead-letter behavior is automatic and test-verified.
- CI/CD webhook events are persisted and available for PR status views.
- Validation and typed errors reduce crash/retry ambiguity.
- Every task commit passes coverage, lint, formatting, and format-check gates.
