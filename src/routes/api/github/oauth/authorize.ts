import { createFileRoute } from "@tanstack/react-router"
import { getGitHubOAuthClientId } from "@/lib/GithubApp"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/github/oauth/authorize")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url)
        const userId = url.searchParams.get("userId")
        const clientId = getGitHubOAuthClientId()

        if (!userId) {
          return jsonResponse({ error: "userId is required" }, 400)
        }

        if (!clientId) {
          return jsonResponse({ error: "GitHub OAuth not configured" }, 500)
        }

        const baseUrl = process.env.BASE_URL || new URL(request.url).origin
        const callbackUrl = `${baseUrl}/api/github/oauth/user-callback`

        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: callbackUrl,
          state: userId,
        })

        return new Response(null, {
          status: 302,
          headers: {
            Location: `https://github.com/login/oauth/authorize?${params.toString()}`,
          },
        })
      },
    },
  },
})
