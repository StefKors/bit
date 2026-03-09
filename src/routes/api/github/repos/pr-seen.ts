import { createFileRoute } from "@tanstack/react-router"
import { id } from "@instantdb/admin"
import { adminDb } from "@/lib/InstantAdmin"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

interface PrSeenBody {
  owner: string
  repo: string
  number: number
}

export const parsePrSeenBody = (body: object | null): PrSeenBody | null => {
  if (typeof body !== "object" || body === null) return null
  const payload = body as Partial<PrSeenBody>
  if (
    typeof payload.owner !== "string" ||
    typeof payload.repo !== "string" ||
    typeof payload.number !== "number"
  ) {
    return null
  }

  return {
    owner: payload.owner,
    repo: payload.repo,
    number: payload.number,
  }
}

export const Route = createFileRoute("/api/github/repos/pr-seen")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("Authorization")
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null

        if (!token) {
          return jsonResponse({ error: "Missing or invalid Authorization header" }, 401)
        }

        let user
        try {
          user = await adminDb.auth.verifyToken(token)
        } catch {
          return jsonResponse({ error: "Invalid token" }, 401)
        }

        if (!user?.id) {
          return jsonResponse({ error: "User not found" }, 401)
        }

        let parsedBody: PrSeenBody | null = null
        try {
          const requestBody = (await request.json()) as object | null
          parsedBody = parsePrSeenBody(requestBody)
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400)
        }

        if (!parsedBody) {
          return jsonResponse({ error: "owner, repo, and number are required" }, 400)
        }
        const { owner, repo, number } = parsedBody

        const fullName = `${owner}/${repo}`
        const { repos } = await adminDb.query({
          repos: {
            $: { where: { fullName }, limit: 1 },
            pullRequests: {
              $: { where: { number }, limit: 1, fields: ["number"] },
            },
          },
        })
        const pullRequest = repos?.[0]?.pullRequests?.[0]
        if (!pullRequest) {
          return jsonResponse({ error: "Pull request not found" }, 404)
        }

        const userId = user.id
        const pullRequestId = pullRequest.id
        const now = Date.now()
        const { pullRequestViews } = await adminDb.query({
          pullRequestViews: {
            $: {
              where: {
                userId,
                pullRequestId,
              },
              limit: 1,
            },
          },
        })

        const existingView = pullRequestViews?.[0]
        const viewId = existingView?.id ?? id()
        await adminDb.transact(
          adminDb.tx.pullRequestViews[viewId]
            .update({
              userId,
              pullRequestId,
              lastSeenAt: now,
              createdAt: existingView?.createdAt ?? now,
              updatedAt: now,
            })
            .link({ user: userId, pullRequest: pullRequestId }),
        )

        return jsonResponse({ ok: true, pullRequestId, lastSeenAt: now })
      },
    },
  },
})
