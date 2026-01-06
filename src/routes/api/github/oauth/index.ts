import { createFileRoute } from "@tanstack/react-router"

// GitHub OAuth initiation endpoint
// Redirects user to GitHub to authorize the app

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID

// Scopes needed for full GitHub integration:
// - repo: Full control of private repositories (read/write)
// - read:org: Read org and team membership
// - read:user: Read user profile data
// - user:email: Access user email addresses
const SCOPES = ["repo", "read:org", "read:user", "user:email"].join(" ")

export const Route = createFileRoute("/api/github/oauth/")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url)
        const userId = url.searchParams.get("userId")

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

        const params = new URLSearchParams({
          client_id: GITHUB_CLIENT_ID,
          redirect_uri: `${process.env.BASE_URL}/api/github/oauth/callback`,
          scope: SCOPES,
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
