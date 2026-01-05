/**
 * GitHub Webhook Handlers
 *
 * This module contains handlers for GitHub webhook events. Each handler is
 * responsible for processing a specific event type and syncing data to the database.
 *
 * Auto-tracking behavior:
 * All handlers support auto-tracking. When a webhook event arrives:
 * 1. If the resource (repo/PR) is already tracked → updates existing records
 * 2. If not tracked but the webhook sender is a registered user → auto-creates records
 * 3. If sender is not registered → logs and skips
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
export { handleIssueWebhook, ensureIssueFromWebhook } from "./issue"
export { handleIssueCommentWebhook } from "./issue-comment"
