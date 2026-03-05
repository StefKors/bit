import { createFileRoute } from "@tanstack/react-router"
import { adminDb } from "@/lib/InstantAdmin"
import { exchangeCodeForUserToken } from "@/lib/GithubApp"
import { log } from "@/lib/Logger"

export const Route = createFileRoute("/api/github/oauth/user-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get("code")
        const state = url.searchParams.get("state")
        const error = url.searchParams.get("error")

        if (error) {
          const desc = url.searchParams.get("error_description") || error
          log.warn("GitHub user OAuth error", { error: desc })
          return new Response(null, {
            status: 302,
            headers: {
              Location: `/?error=${encodeURIComponent(desc)}`,
            },
          })
        }

        if (!code || !state) {
          return new Response(null, {
            status: 302,
            headers: { Location: "/?error=Missing+code+or+state+parameter" },
          })
        }

        const accessToken = await exchangeCodeForUserToken(code)
        if (!accessToken) {
          return new Response(null, {
            status: 302,
            headers: { Location: "/?error=Failed+to+exchange+GitHub+token" },
          })
        }

        const userId = state
        const now = Date.now()

        await adminDb.transact(
          adminDb.tx.$users[userId].update({
            githubAccessToken: accessToken,
            updatedAt: now,
          }),
        )

        log.info("GitHub user OAuth: stored access token", { userId })

        return new Response(null, {
          status: 302,
          headers: {
            Location: "/?github=authorized&message=GitHub+account+authorized",
          },
        })
      },
    },
  },
})
