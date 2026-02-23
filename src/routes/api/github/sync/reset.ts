import { createFileRoute } from "@tanstack/react-router"
import { adminDb } from "@/lib/instantAdmin"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/sync/reset")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            resourceType: string
            resourceId?: string
          }
          const { resourceType, resourceId } = body

          if (!resourceType) {
            return jsonResponse({ error: "resourceType is required" }, 400)
          }

          // Get current user from Authorization header
          const authHeader = request.headers.get("Authorization")
          const userId = authHeader?.replace("Bearer ", "")

          if (!userId) {
            return jsonResponse({ error: "Not authenticated" }, 401)
          }

          // Find sync state to reset
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

          // Reset sync state by clearing error and ETag data
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
          console.error("Error resetting sync state:", error)
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
        try {
          // Get current user from Authorization header
          const authHeader = request.headers.get("Authorization")
          const userId = authHeader?.replace("Bearer ", "")

          if (!userId) {
            return jsonResponse({ error: "Not authenticated" }, 401)
          }

          // Find all sync states for this user
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
          console.error("Error clearing sync states:", error)
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
