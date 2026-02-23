import { createFileRoute } from "@tanstack/react-router"
import { revokeGitHubGrantForUser, isReconnectRequest } from "@/lib/github-connection"
import { OAUTH_SCOPE_PARAM } from "@/lib/github-permissions"
import { log } from "@/lib/logger"

// GitHub OAuth initiation endpoint
// Redirects user to GitHub to authorize the app

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID

export const Route = createFileRoute("/api/github/oauth/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const userId = url.searchParams.get("userId")
        const reconnect = isReconnectRequest(url.searchParams.get("reconnect"))

        if (!userId) {
          return new Response(JSON.stringify({ error: "userId is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          })
        }

        if (!GITHUB_CLIENT_ID) {
          return new Response(JSON.stringify({ error: "GitHub OAuth not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          })
        }

        if (reconnect) {
          const revokeResult = await revokeGitHubGrantForUser(userId)
          if (revokeResult.attempted && !revokeResult.revoked) {
            log.warn("Reconnect requested but existing grant revocation failed", {
              userId,
              reason: revokeResult.reason,
            })
          }
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
    },
  },
})
