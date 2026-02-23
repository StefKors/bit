/**
 * GitHub Webhook Handlers
 *
 * This module contains handlers for GitHub webhook events. Each handler is
 * responsible for processing a specific event type and syncing data to the database.
 *
 * Auto-tracking behavior:
 * All handlers support auto-tracking. When a webhook event arrives:
 * 1. If the resource (repo/PR/issue) is already tracked → updates existing records
 * 2. If not tracked but the webhook sender is a registered user → auto-creates records
 * 3. If sender is not registered → logs and skips
 *
 * Supported events:
 * - pull_request: PR opened, closed, merged, edited, etc.
 * - pull_request_review: Review submitted (approved, changes requested, etc.)
 * - pull_request_review_comment / issue_comment: Comments on PRs
 * - push: Code pushed to repo (updates tree cache, syncs commits to PRs)
 * - create: Branch or tag created
 * - delete: Branch or tag deleted (cleans up tree cache for githubRepoTree)
 * - issues: Issue opened, closed, edited, labeled, etc.
 * - issue_comment: Comments on issues (when not on a PR)
 *
 * File viewer entities synced:
 * - githubRepoTree: Invalidated on push/delete events so data is re-fetched
 * - githubRepoBlob: File contents cached on demand via API
 *
 * @see AGENTS.md for detailed documentation on webhook handling patterns
 */

export * from "./types"
export * from "./utils"
export { handlePullRequestWebhook } from "./pull-request"
export { handlePullRequestReviewWebhook } from "./pull-request-review"
export { handleCommentWebhook } from "./comment"
export { handlePushWebhook } from "./push"
export { handleRepositoryWebhook, handleStarWebhook, handleForkWebhook } from "./repository"
export { handleOrganizationWebhook, ensureOrgFromWebhook } from "./organization"
export { handleCreateWebhook } from "./create"
export { handleDeleteWebhook } from "./delete"
export { handlePullRequestEventWebhook } from "./pr-event"
export { handleIssueWebhook, ensureIssueFromWebhook } from "./issue"
export { handleIssueCommentWebhook } from "./issue-comment"
export {
  handleCheckRunWebhook,
  handleCheckSuiteWebhook,
  handleStatusWebhook,
  handleWorkflowRunWebhook,
  handleWorkflowJobWebhook,
} from "./ci-cd"
export {
  enqueueWebhook,
  processQueueItem,
  processPendingQueue,
  dispatchWebhookEvent,
  calculateBackoff,
} from "./processor"
