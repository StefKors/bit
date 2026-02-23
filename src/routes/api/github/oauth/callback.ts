import { createFileRoute } from "@tanstack/react-router"
import { adminDb } from "@/lib/instantAdmin"
import { GitHubClient } from "@/lib/github-client"
import { findOrCreateSyncStateId } from "@/lib/sync-state"
import { parseScopes, checkPermissions, REQUIRED_SCOPES } from "@/lib/github-permissions"
import { log } from "@/lib/logger"

// GitHub OAuth callback handler
// This is called after the user authorizes the GitHub App
// It exchanges the code for an access token and stores it in the user record

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET

interface GitHubTokenResponse {
  access_token: string
  token_type: string
  scope: string
  error?: string
  error_description?: string
}

interface GitHubUser {
  login: string
  id: number
  node_id: string
  name?: string
  email?: string | null
  avatar_url: string
  gravatar_id: string
  url: string
  html_url: string
  followers_url: string
  following_url: string
  gists_url: string
  starred_url: string
  subscriptions_url: string
  organizations_url: string
  repos_url: string
  events_url: string
  received_events_url: string
  type: "Bot" | "User" | "Organization"
  site_admin: boolean
}

export const Route = createFileRoute("/api/github/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get("code")
        const state = url.searchParams.get("state") // Contains the InstantDB user ID
        const error = url.searchParams.get("error")
        const errorDescription = url.searchParams.get("error_description")

        // GitHub App installation parameters
        const installationId = url.searchParams.get("installation_id")
        const setupAction = url.searchParams.get("setup_action")

        // Handle OAuth errors
        if (error) {
          log.error("GitHub OAuth error", error, { description: errorDescription })
          return new Response(null, {
            status: 302,
            headers: {
              Location: `/?error=${encodeURIComponent(errorDescription || error)}`,
            },
          })
        }

        // Handle GitHub App installation callback (no code, has installation_id)
        // This happens when user installs the app from GitHub directly
        // We need to redirect them to complete OAuth authorization
        if (installationId && !code) {
          log.info("GitHub App installed", { installationId, setupAction })
          // Redirect to home with a message to complete setup
          return new Response(null, {
            status: 302,
            headers: {
              Location:
                "/?github=installed&message=App+installed!+Click+Connect+GitHub+to+complete+setup",
            },
          })
        }

        if (!code || !state) {
          return new Response(null, {
            status: 302,
            headers: {
              Location: "/?error=Missing+code+or+state+parameter",
            },
          })
        }

        if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
          log.error(
            "GitHub OAuth not configured",
            "Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET",
          )
          return new Response(null, {
            status: 302,
            headers: {
              Location: "/?error=GitHub+OAuth+not+configured",
            },
          })
        }

        try {
          // Exchange code for access token
          const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              client_id: GITHUB_CLIENT_ID,
              client_secret: GITHUB_CLIENT_SECRET,
              code,
            }),
          })

          const tokenData = (await tokenResponse.json()) as GitHubTokenResponse

          if (tokenData.error) {
            log.error("GitHub token exchange failed", tokenData.error, {
              description: tokenData.error_description,
              userId: state,
            })
            return new Response(null, {
              status: 302,
              headers: {
                Location: `/?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`,
              },
            })
          }

          const accessToken = tokenData.access_token

          // Validate granted scopes
          const grantedScopes = parseScopes(tokenData.scope)
          const permReport = checkPermissions(grantedScopes)
          if (!permReport.allGranted) {
            log.warn("OAuth token granted with missing scopes", {
              userId: state,
              granted: grantedScopes.join(", ") || "(none)",
              missing: permReport.missingScopes.join(", "),
              required: REQUIRED_SCOPES.join(", "),
            })
          } else {
            log.info("OAuth token granted with all required scopes", {
              userId: state,
              scopes: grantedScopes.join(", "),
            })
          }

          // Fetch GitHub user info
          const userResponse = await fetch("https://api.github.com/user", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
          })

          if (!userResponse.ok) {
            log.error("Failed to fetch GitHub user", `HTTP ${userResponse.status}`, {
              userId: state,
            })
            return new Response(null, {
              status: 302,
              headers: {
                Location: "/?error=Failed+to+fetch+GitHub+user+info",
              },
            })
          }

          const githubUser = (await userResponse.json()) as GitHubUser
          const now = Date.now()

          // Update the user record with GitHub info and access token
          // The state contains the InstantDB user ID
          const userId = state
          await adminDb.transact(
            adminDb.tx.$users[userId].update({
              login: githubUser.login,
              githubId: githubUser.id,
              nodeId: githubUser.node_id,
              name: githubUser.name || undefined,
              avatarUrl: githubUser.avatar_url,
              gravatarId: githubUser.gravatar_id,
              url: githubUser.url,
              htmlUrl: githubUser.html_url,
              followersUrl: githubUser.followers_url,
              followingUrl: githubUser.following_url,
              gistsUrl: githubUser.gists_url,
              starredUrl: githubUser.starred_url,
              subscriptionsUrl: githubUser.subscriptions_url,
              organizationsUrl: githubUser.organizations_url,
              reposUrl: githubUser.repos_url,
              eventsUrl: githubUser.events_url,
              receivedEventsUrl: githubUser.received_events_url,
              type: githubUser.type,
              siteAdmin: githubUser.site_admin,
              updatedAt: now,
            }),
          )

          // Store access token securely
          // We'll store it in a separate "tokens" table or as part of the user
          // For now, we'll use environment variable storage approach
          // In production, you'd want to encrypt this token

          // Also store the access token in a sync state record for this user
          const tokenStateId = await findOrCreateSyncStateId("github:token", userId)
          await adminDb.transact(
            adminDb.tx.syncStates[tokenStateId]
              .update({
                resourceType: "github:token",
                resourceId: "access_token",
                lastEtag: accessToken, // Using lastEtag to store the token (encrypted in production)
                syncStatus: "idle",
                userId,
                createdAt: now,
                updatedAt: now,
              })
              .link({ user: userId }),
          )

          log.info("GitHub connected", { userId, login: githubUser.login })

          // Perform initial sync in the background (don't block the redirect)
          // We use the access token directly since the sync state was just created
          const githubClient = new GitHubClient(accessToken, userId)
          githubClient
            .performInitialSync()
            .then((result) => {
              log.info("Initial sync completed", { userId, ...result })
            })
            .catch((err) => {
              log.error("Initial sync failed", err, { userId })
            })

          // Redirect back to the app
          return new Response(null, {
            status: 302,
            headers: {
              Location: "/?github=connected",
            },
          })
        } catch (err) {
          log.error("GitHub OAuth callback error", err, { userId: state })
          return new Response(null, {
            status: 302,
            headers: {
              Location: `/?error=${encodeURIComponent(err instanceof Error ? err.message : "OAuth failed")}`,
            },
          })
        }
      },
    },
  },
})
