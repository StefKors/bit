import { createFileRoute } from "@tanstack/react-router"
import { RequestError } from "octokit"
import { createGitHubClient } from "@/lib/github-client"
import { adminDb } from "@/lib/instantAdmin"
import { mapWithConcurrency } from "@/lib/sync-ingest"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export interface WebhookLevelsResponse {
  orgs: Array<{
    login: string
    level: "has_webhooks" | "no_webhooks" | "no_access"
    error?: string
  }>
  repos: {
    installed: number
    pending: number
    noAccess: number
    error: number
  }
}

export const Route = createFileRoute("/api/github/webhook-levels")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = request.headers.get("Authorization")?.replace("Bearer ", "")
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const client = await createGitHubClient(userId)
        if (!client) {
          return jsonResponse({ error: "GitHub account not connected" }, 400)
        }

        const { repos: reposList } = await adminDb.query({
          repos: { $: { where: { userId } }, organization: {} },
        })

        const repos = reposList ?? []
        const orgLogins = [
          ...new Set(repos.map((r) => r.organization?.login).filter(Boolean)),
        ] as string[]
        const orgsList = orgLogins.map((login) => ({ login }))

        const orgResults = await mapWithConcurrency(orgsList, 3, async (org) => {
          try {
            const hooks = await client.listOrgWebhooks(org.login)
            const hasOurs = hooks.some((h) => h.isOurs)
            return {
              login: org.login,
              level: hasOurs ? ("has_webhooks" as const) : ("no_webhooks" as const),
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            const is403 = err instanceof RequestError && err.status === 403
            return {
              login: org.login,
              level: is403 ? ("no_access" as const) : ("no_webhooks" as const),
              error: msg,
            }
          }
        })

        const repoStats = reposList.reduce(
          (acc, r) => {
            const s = r.webhookStatus
            if (s === "installed") acc.installed += 1
            else if (s === "no_access") acc.noAccess += 1
            else if (s === "error") acc.error += 1
            else acc.pending += 1
            return acc
          },
          { installed: 0, pending: 0, noAccess: 0, error: 0 },
        )

        return jsonResponse({
          orgs: orgResults,
          repos: repoStats,
        } satisfies WebhookLevelsResponse)
      },
    },
  },
})
