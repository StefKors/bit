import { createFileRoute } from "@tanstack/react-router"
import { revokeGitHubGrantForUser } from "@/lib/github-connection"
import { OAUTH_SCOPE_PARAM } from "@/lib/github-permissions"
import { log } from "@/lib/logger"

// GitHub OAuth initiation endpoint
// Redirects user to GitHub to authorize the app

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
const BEARER_PREFIX = "Bearer "

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/oauth/")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url)
        const userId = url.searchParams.get("userId")

        if (!userId) {
          return jsonResponse({ error: "userId is required" }, 400)
        }

        if (!GITHUB_CLIENT_ID) {
          return jsonResponse({ error: "GitHub OAuth not configured" }, 500)
        }

        const params = new URLSearchParams({
          client_id: GITHUB_CLIENT_ID,
          redirect_uri: `${process.env.BASE_URL}/api/github/oauth/callback`,
          scope: OAUTH_SCOPE_PARAM,
          state: userId, // Pass the user ID as state to link the GitHub account
          allow_signup: "true",
        })

        const githubAuthUrl = `https://github.com/login/oauth/authorize?${params.toString()}`

        return new Response(null, {
          status: 302,
          headers: {
            Location: githubAuthUrl,
          },
        })
      },

      POST: async ({ request }) => {
        const authHeader =
          request.headers.get("authorization") || request.headers.get("Authorization")
        if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) {
          return jsonResponse({ error: "Unauthorized reconnect request" }, 401)
        }

        const authUserId = authHeader.slice(BEARER_PREFIX.length).trim()
        if (!authUserId) {
          return jsonResponse({ error: "Unauthorized reconnect request" }, 401)
        }

        let bodyUserId: string | undefined
        try {
          const body = (await request.json()) as { userId?: string }
          bodyUserId = body.userId
        } catch {
          return jsonResponse({ error: "Invalid reconnect request body" }, 400)
        }

        if (bodyUserId && bodyUserId !== authUserId) {
          return jsonResponse({ error: "Unauthorized reconnect request" }, 401)
        }

        const revokeResult = await revokeGitHubGrantForUser(authUserId)
        if (revokeResult.attempted && !revokeResult.revoked) {
          log.warn("Authenticated reconnect revocation failed", {
            userId: authUserId,
            reason: revokeResult.reason,
          })
        }

        return jsonResponse({
          success: true,
          revoked: revokeResult.revoked,
          reason: revokeResult.reason,
        })
      },
    },
  },
})
