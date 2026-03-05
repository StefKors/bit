import { createFileRoute } from "@tanstack/react-router"
import { adminDb } from "@/lib/InstantAdmin"
import {
  storeInstallationId,
  getInstallationAccount,
  exchangeCodeForUserToken,
} from "@/lib/GithubApp"
import { log } from "@/lib/Logger"

export const Route = createFileRoute("/api/github/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const state = url.searchParams.get("state")
        const error = url.searchParams.get("error")
        const errorDescription = url.searchParams.get("error_description")
        const installationId = url.searchParams.get("installation_id")
        const setupAction = url.searchParams.get("setup_action")
        const code = url.searchParams.get("code")

        if (error) {
          log.error("GitHub installation error", error, { description: errorDescription })
          return new Response(null, {
            status: 302,
            headers: {
              Location: `/?error=${encodeURIComponent(errorDescription || error)}`,
            },
          })
        }

        if (installationId && state) {
          log.info("GitHub App installed", { installationId, setupAction })
          const instId = Number.parseInt(installationId, 10)
          if (!Number.isFinite(instId)) {
            return new Response(null, {
              status: 302,
              headers: { Location: "/?error=Invalid+installation+id" },
            })
          }

          const account = await getInstallationAccount(instId)
          const now = Date.now()
          const userUpdate: Record<string, string | number> = { updatedAt: now }

          if (account) {
            userUpdate.login = account.login
            userUpdate.githubId = account.githubId
            userUpdate.avatarUrl = account.avatarUrl
            userUpdate.htmlUrl = account.htmlUrl
          }

          if (code) {
            const accessToken = await exchangeCodeForUserToken(code)
            if (accessToken) {
              userUpdate.githubAccessToken = accessToken
              log.info("GitHub OAuth: stored user token during installation", { userId: state })
            }
          }

          await adminDb.transact(adminDb.tx.$users[state].update(userUpdate))
          await storeInstallationId(state, installationId, account?.login)

          return new Response(null, {
            status: 302,
            headers: {
              Location: "/?github=connected&message=GitHub+App+installed",
            },
          })
        }

        return new Response(null, {
          status: 302,
          headers: {
            Location: "/?error=Missing+installation+or+state+parameter",
          },
        })
      },
    },
  },
})
