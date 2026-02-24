import { id } from "@instantdb/admin"
import type { PullRequestEvent, WebhookDB, WebhookPayload } from "./types"
import { findUserBySender, ensureRepoFromWebhook, ensurePRFromWebhook } from "./utils"

/**
 * Event types that should be recorded in the prEvents table.
 * These are PR actions that represent timeline events.
 */
const TRACKED_PR_EVENTS = [
  "labeled",
  "unlabeled",
  "assigned",
  "unassigned",
  "review_requested",
  "review_request_removed",
  "closed",
  "reopened",
  "converted_to_draft",
  "ready_for_review",
  "locked",
  "unlocked",
  "milestoned",
  "demilestoned",
] as const

type TrackedPREvent = (typeof TRACKED_PR_EVENTS)[number]

const isTrackedEvent = (action: string): action is TrackedPREvent =>
  TRACKED_PR_EVENTS.includes(action as TrackedPREvent)

/**
 * Handle pull_request webhook events and create prEvent records.
 *
 * This handler creates event timeline entries for PR activities like
 * labeling, assignments, review requests, and state changes.
 */
export async function handlePullRequestEventWebhook(db: WebhookDB, payload: WebhookPayload) {
  const typedPayload = payload as PullRequestEvent
  const { action, pull_request: pr, repository: repo, sender } = typedPayload
  if (!isTrackedEvent(action)) return

  const repoFullName = repo.full_name

  // Find users who have this repo synced
  const reposResult = await db.query({
    repos: {
      $: { where: { fullName: repoFullName } },
    },
  })

  let repoRecords = reposResult.repos || []

  // If no users tracking, try to auto-track for the webhook sender
  if (repoRecords.length === 0) {
    const userId = await findUserBySender(db, sender)
    if (userId) {
      const newRepo = await ensureRepoFromWebhook(db, repo, userId)
      if (newRepo) {
        repoRecords = [newRepo]
      }
    }
  }

  if (repoRecords.length === 0) {
    console.log(`No users tracking repo ${repoFullName} for PR event`)
    return
  }

  for (const repoRecord of repoRecords) {
    // Ensure PR exists in database
    const prRecord = await ensurePRFromWebhook(db, pr, repoRecord)
    if (!prRecord) continue

    // Generate a UUID for the event
    const eventId = id()

    const now = Date.now()
    const baseEventData: Record<string, string | number | boolean | null> = {
      pullRequestId: prRecord.id, // Use the actual PR record ID
      eventType: action,
      actorLogin: sender.login || null,
      actorAvatarUrl: sender.avatar_url || null,
      eventCreatedAt: now,
      userId: repoRecord.userId,
      createdAt: now,
      updatedAt: now,
    }

    let eventData: Record<string, string | number | boolean | null> = { ...baseEventData }

    // Add event-specific data
    switch (action) {
      case "labeled":
      case "unlabeled": {
        const label = "label" in typedPayload ? typedPayload.label : null
        if (label) {
          eventData = {
            ...eventData,
            labelName: label.name || null,
            labelColor: label.color || null,
          }
        }
        break
      }

      case "assigned":
      case "unassigned": {
        const assignee = "assignee" in typedPayload ? typedPayload.assignee : null
        if (assignee) {
          eventData = {
            ...eventData,
            assigneeLogin: assignee.login || null,
            assigneeAvatarUrl: assignee.avatar_url || null,
          }
        }
        break
      }

      case "review_requested":
      case "review_request_removed": {
        const requestedReviewer =
          "requested_reviewer" in typedPayload ? typedPayload.requested_reviewer : null
        if (requestedReviewer) {
          eventData = {
            ...eventData,
            requestedReviewerLogin: requestedReviewer.login || null,
            requestedReviewerAvatarUrl: requestedReviewer.avatar_url || null,
          }
        }
        break
      }

      case "closed":
      case "reopened":
      case "converted_to_draft":
      case "ready_for_review":
      case "locked":
      case "unlocked":
      case "milestoned":
      case "demilestoned": {
        // Store the full event payload for complex events
        eventData = {
          ...eventData,
          eventData: JSON.stringify({
            action,
            merged: pr.merged ?? false,
            milestone: "milestone" in typedPayload ? typedPayload.milestone : null,
          }),
        }
        break
      }
    }

    await db.transact(db.tx.prEvents[eventId].update(eventData))
  }

  console.log(`Processed pull_request.${action} event for ${repoFullName}#${pr.number}`)
}
