import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod/v4"
import { adminDb } from "@/lib/instantAdmin"
import { log } from "@/lib/logger"

const resetBodySchema = z.object({
  resourceType: z.string().min(1, "resourceType is required"),
  resourceId: z.string().optional(),
})

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/sync/reset")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("Authorization")
        const userId = authHeader?.replace("Bearer ", "")

        if (!userId) {
          return jsonResponse({ error: "Not authenticated" }, 401)
        }

        try {
          const parsed = resetBodySchema.safeParse(await request.json())
          if (!parsed.success) {
            return jsonResponse(
              { error: "Invalid request body", details: parsed.error.message },
              400,
            )
          }
          const { resourceType, resourceId } = parsed.data

          const { syncStates } = await adminDb.query({
            syncStates: {
              $: {
                where: {
                  resourceType,
                  userId,
                  ...(resourceId ? { resourceId } : {}),
                },
              },
            },
          })

          const syncState = syncStates?.[0]
          if (!syncState) {
            return jsonResponse({ error: "Sync state not found" }, 404)
          }

          await adminDb.transact(
            adminDb.tx.syncStates[syncState.id].update({
              syncStatus: "idle",
              syncError: undefined,
              lastEtag: undefined,
              lastSyncedAt: undefined,
              updatedAt: Date.now(),
            }),
          )

          return jsonResponse({ success: true })
        } catch (error) {
          log.error("Error resetting sync state", error, { op: "sync-reset", userId })
          return jsonResponse(
            {
              error: "Internal server error",
              details: error instanceof Error ? error.message : "Unknown error",
            },
            500,
          )
        }
      },

      DELETE: async ({ request }) => {
        const authHeader = request.headers.get("Authorization")
        const userId = authHeader?.replace("Bearer ", "")

        if (!userId) {
          return jsonResponse({ error: "Not authenticated" }, 401)
        }

        try {
          const { syncStates } = await adminDb.query({
            syncStates: {
              $: {
                where: {
                  userId,
                },
              },
            },
          })

          const now = Date.now()
          const deleteTxs = (syncStates ?? []).map((s) => adminDb.tx.syncStates[s.id].delete())
          const clearUserTxs = [
            adminDb.tx.$users[userId].update({
              login: undefined,
              githubId: undefined,
              nodeId: undefined,
              name: undefined,
              avatarUrl: undefined,
              gravatarId: undefined,
              url: undefined,
              htmlUrl: undefined,
              followersUrl: undefined,
              followingUrl: undefined,
              gistsUrl: undefined,
              starredUrl: undefined,
              subscriptionsUrl: undefined,
              organizationsUrl: undefined,
              reposUrl: undefined,
              eventsUrl: undefined,
              receivedEventsUrl: undefined,
              type: undefined,
              siteAdmin: undefined,
              updatedAt: now,
            }),
          ]
          await adminDb.transact([...deleteTxs, ...clearUserTxs])

          return jsonResponse({
            success: true,
            deleted: syncStates?.length ?? 0,
          })
        } catch (error) {
          log.error("Error clearing sync states", error, { op: "sync-reset-delete", userId })
          return jsonResponse(
            {
              error: "Internal server error",
              details: error instanceof Error ? error.message : "Unknown error",
            },
            500,
          )
        }
      },
    },
  },
})
