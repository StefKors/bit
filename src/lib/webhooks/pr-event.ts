import { id } from "@instantdb/admin"
import type { WebhookDB, WebhookPayload } from "./types"
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
  const action = payload.action as string
  const pr = payload.pull_request as Record<string, unknown>
  const repo = payload.repository as Record<string, unknown>
  const sender = payload.sender as Record<string, unknown>

  if (!pr || !repo || !isTrackedEvent(action)) return

  const repoFullName = repo.full_name as string

  // Find users who have this repo synced
  const reposResult = await db.query({
    repos: {
      $: { where: { fullName: repoFullName } },
    },
  })

  let repoRecords = reposResult.repos || []

  // If no users tracking, try to auto-track for the webhook sender
  if (repoRecords.length === 0 && sender) {
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
    const baseEventData: Record<string, unknown> = {
      pullRequestId: prRecord.id, // Use the actual PR record ID
      eventType: action,
      actorLogin: (sender?.login as string) || null,
      actorAvatarUrl: (sender?.avatar_url as string) || null,
      eventCreatedAt: now,
      userId: repoRecord.userId,
      createdAt: now,
      updatedAt: now,
    }

    let eventData: Record<string, unknown> = { ...baseEventData }

    // Add event-specific data
    switch (action) {
      case "labeled":
      case "unlabeled": {
        const label = payload.label as Record<string, unknown>
        if (label) {
          eventData = {
            ...eventData,
            labelName: (label.name as string) || null,
            labelColor: (label.color as string) || null,
          }
        }
        break
      }

      case "assigned":
      case "unassigned": {
        const assignee = payload.assignee as Record<string, unknown>
        if (assignee) {
          eventData = {
            ...eventData,
            assigneeLogin: (assignee.login as string) || null,
            assigneeAvatarUrl: (assignee.avatar_url as string) || null,
          }
        }
        break
      }

      case "review_requested":
      case "review_request_removed": {
        const requestedReviewer = payload.requested_reviewer as Record<string, unknown>
        if (requestedReviewer) {
          eventData = {
            ...eventData,
            requestedReviewerLogin: (requestedReviewer.login as string) || null,
            requestedReviewerAvatarUrl: (requestedReviewer.avatar_url as string) || null,
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
            milestone: payload.milestone ?? null,
          }),
        }
        break
      }
    }

    await db.transact(db.tx.prEvents[eventId].update(eventData))
  }

  console.log(`Processed pull_request.${action} event for ${repoFullName}#${pr.number as number}`)
}
