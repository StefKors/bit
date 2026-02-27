import { createFileRoute } from "@tanstack/react-router"

// Redirects to GitHub App installation (legacy OAuth route - now uses app-only flow)
const GITHUB_APP_SLUG = process.env.GITHUB_APP_SLUG || "bit-backend"

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

        const installUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?${new URLSearchParams({ state: userId }).toString()}`
        return new Response(null, {
          status: 302,
          headers: { Location: installUrl },
        })
      },
    },
  },
})
