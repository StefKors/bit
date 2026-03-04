import { createFileRoute } from "@tanstack/react-router"
import { adminDb } from "@/lib/instantAdmin"
import { storeInstallationId, getInstallationAccount } from "@/lib/github-app"
import { log } from "@/lib/logger"

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
          if (account) {
            const now = Date.now()
            await adminDb.transact(
              adminDb.tx.$users[state].update({
                login: account.login,
                githubId: account.githubId,
                avatarUrl: account.avatarUrl,
                htmlUrl: account.htmlUrl,
                updatedAt: now,
              }),
            )
          }

          await storeInstallationId(state, installationId)

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
