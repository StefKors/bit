import { eq } from "drizzle-orm"
import * as dbSchema from "../../../schema"
import type { WebhookDB, WebhookPayload, OrganizationEvent } from "./types"
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
  const now = new Date()

  // Find users who have this org synced
  let orgRecords = await db
    .select()
    .from(dbSchema.githubOrganization)
    .where(eq(dbSchema.githubOrganization.login, orgLogin))

  // If no users tracking, try to auto-track for the webhook sender
  if (orgRecords.length === 0 && sender) {
    const userId = await findUserBySender(db, sender as Record<string, unknown>)
    if (userId) {
      const newOrg = await ensureOrgFromWebhook(
        db,
        org as unknown as Record<string, unknown>,
        userId,
      )
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
      await db
        .delete(dbSchema.githubOrganization)
        .where(eq(dbSchema.githubOrganization.id, orgRecord.id))
    }
    console.log(`Deleted org ${orgLogin} from all tracking users`)
    return
  }

  // Update org metadata for all tracked instances
  for (const orgRecord of orgRecords) {
    await db
      .update(dbSchema.githubOrganization)
      .set({
        login: org.login,
        name: (org as { name?: string | null }).name || null,
        description: org.description || null,
        avatarUrl: org.avatar_url || null,
        url: org.url || null,
        syncedAt: now,
        updatedAt: now,
      })
      .where(eq(dbSchema.githubOrganization.id, orgRecord.id))
  }

  console.log(`Processed organization ${action} event for ${orgLogin}`)
}

/**
 * Create or update an organization record from webhook payload data.
 * Used for auto-tracking orgs when webhooks arrive.
 */
export async function ensureOrgFromWebhook(
  db: WebhookDB,
  org: Record<string, unknown>,
  userId: string,
) {
  const nodeId = org.node_id as string
  const login = org.login as string

  // Check if org already exists for this user
  const existing = await db
    .select()
    .from(dbSchema.githubOrganization)
    .where(eq(dbSchema.githubOrganization.login, login))
    .limit(1)

  if (existing[0]) {
    return existing[0]
  }

  const orgData = {
    id: nodeId,
    githubId: org.id as number,
    login,
    name: (org.name as string) || null,
    description: (org.description as string) || null,
    avatarUrl: (org.avatar_url as string) || null,
    url: (org.url as string) || null,
    userId,
    syncedAt: new Date(),
  }

  await db
    .insert(dbSchema.githubOrganization)
    .values(orgData)
    .onConflictDoUpdate({
      target: dbSchema.githubOrganization.id,
      set: {
        login: orgData.login,
        name: orgData.name,
        description: orgData.description,
        avatarUrl: orgData.avatarUrl,
        url: orgData.url,
        syncedAt: new Date(),
        updatedAt: new Date(),
      },
    })

  const inserted = await db
    .select()
    .from(dbSchema.githubOrganization)
    .where(eq(dbSchema.githubOrganization.login, login))
    .limit(1)

  console.log(`Auto-tracked org ${login} for user ${userId}`)

  return inserted[0] ?? null
}
