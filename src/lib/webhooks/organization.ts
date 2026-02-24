import { id } from "@instantdb/admin"
import type { Organization, OrganizationEvent, WebhookDB, WebhookPayload } from "./types"
import { findUserBySender } from "./utils"

/**
 * Handle organization webhook events.
 *
 * Syncs organization metadata updates including:
 * - Name/description changes
 * - Member added/removed (for tracking purposes)
 * - Organization deleted
 *
 * Auto-tracking behavior:
 * - If org is tracked → updates metadata for all users tracking it
 * - If not tracked but sender is registered → auto-creates org
 * - If sender not registered → logs and skips
 */
export async function handleOrganizationWebhook(db: WebhookDB, payload: WebhookPayload) {
  const orgPayload = payload as unknown as OrganizationEvent
  const org = orgPayload.organization
  const sender = orgPayload.sender
  const action = orgPayload.action

  if (!org) return

  const orgLogin = org.login
  const now = Date.now()

  // Find users who have this org synced
  const orgsResult = await db.query({
    organizations: {
      $: { where: { login: orgLogin } },
    },
  })

  let orgRecords = orgsResult.organizations || []

  // If no users tracking, try to auto-track for the webhook sender
  if (orgRecords.length === 0) {
    const userId = await findUserBySender(db, sender)
    if (userId) {
      const newOrg = await ensureOrgFromWebhook(db, org, userId)
      if (newOrg) {
        orgRecords = [newOrg]
      }
    }
  }

  if (orgRecords.length === 0) {
    console.log(`No users tracking org ${orgLogin} and sender not registered`)
    return
  }

  // Handle deletion - remove org records
  if (action === "deleted") {
    for (const orgRecord of orgRecords) {
      await db.transact(db.tx.organizations[orgRecord.id].delete())
    }
    console.log(`Deleted org ${orgLogin} from all tracking users`)
    return
  }

  // Update org metadata for all tracked instances
  for (const orgRecord of orgRecords) {
    const orgName = "name" in org && typeof org.name === "string" ? org.name : null
    await db.transact(
      db.tx.organizations[orgRecord.id].update({
        login: org.login,
        name: orgName,
        description: org.description || null,
        avatarUrl: org.avatar_url || null,
        url: org.url || null,
        syncedAt: now,
        updatedAt: now,
      }),
    )
  }

  console.log(`Processed organization ${action} event for ${orgLogin}`)
}

/**
 * Create or update an organization record from webhook payload data.
 * Used for auto-tracking orgs when webhooks arrive.
 */
export async function ensureOrgFromWebhook(db: WebhookDB, org: Organization, userId: string) {
  const githubId = org.id
  const login = org.login

  // Check if org already exists by githubId
  const existingResult = await db.query({
    organizations: {
      $: { where: { githubId }, limit: 1 },
    },
  })

  const existing = existingResult.organizations || []
  if (existing[0]) {
    return existing[0]
  }

  // Generate a UUID for this org
  const orgId = id()

  const now = Date.now()
  const orgName = "name" in org && typeof org.name === "string" ? org.name : null
  const orgData = {
    githubId,
    login,
    name: orgName,
    description: org.description || null,
    avatarUrl: org.avatar_url || null,
    url: org.url || null,
    userId,
    syncedAt: now,
    createdAt: now,
    updatedAt: now,
  }

  await db.transact(db.tx.organizations[orgId].update(orgData))

  // Fetch the inserted record
  const insertedResult = await db.query({
    organizations: {
      $: { where: { id: orgId }, limit: 1 },
    },
  })

  const inserted = insertedResult.organizations || []
  console.log(`Auto-tracked org ${login} for user ${userId}`)

  return inserted[0] ?? null
}
