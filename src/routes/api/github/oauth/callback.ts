import { createFileRoute } from "@tanstack/react-router"
import { adminDb } from "@/lib/instantAdmin"
import { GitHubClient } from "@/lib/github-client"
import { storeInstallationId, getInstallationAccount, getInstallationToken } from "@/lib/github-app"
import { log } from "@/lib/logger"

// GitHub App installation callback handler
// Receives redirects from GitHub when user installs the app (with state=userId)

export const Route = createFileRoute("/api/github/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const state = url.searchParams.get("state") // Contains the InstantDB user ID
        const error = url.searchParams.get("error")
        const errorDescription = url.searchParams.get("error_description")

        // GitHub App installation parameters
        const installationId = url.searchParams.get("installation_id")
        const setupAction = url.searchParams.get("setup_action")

        // Handle OAuth/installation errors
        if (error) {
          log.error("GitHub installation error", error, { description: errorDescription })
          return new Response(null, {
            status: 302,
            headers: {
              Location: `/?error=${encodeURIComponent(errorDescription || error)}`,
            },
          })
        }

        // Handle GitHub App installation callback (installation_id + state)
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

          // Trigger initial sync in background
          const token = await getInstallationToken(instId)
          if (token) {
            const githubClient = new GitHubClient(token, state)
            githubClient
              .performInitialSync()
              .then((result) => {
                log.info("Initial sync completed", { userId: state, ...result })
              })
              .catch((err) => {
                log.error("Initial sync failed", err, { userId: state })
              })
          }

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
