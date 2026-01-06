import { createFileRoute } from "@tanstack/react-router"
import { adminDb } from "@/lib/instantAdmin"

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

        // Handle OAuth errors
        if (error) {
          console.error("GitHub OAuth error:", error, errorDescription)
          return new Response(null, {
            status: 302,
            headers: {
              Location: `/?error=${encodeURIComponent(errorDescription || error)}`,
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
          console.error("GitHub OAuth not configured")
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
            console.error(
              "GitHub token exchange error:",
              tokenData.error,
              tokenData.error_description,
            )
            return new Response(null, {
              status: 302,
              headers: {
                Location: `/?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`,
              },
            })
          }

          const accessToken = tokenData.access_token

          // Fetch GitHub user info
          const userResponse = await fetch("https://api.github.com/user", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
          })

          if (!userResponse.ok) {
            console.error("Failed to fetch GitHub user:", userResponse.status)
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
          const tokenStateId = `${userId}:github:token`
          await adminDb.transact(
            adminDb.tx.syncStates[tokenStateId]
              .update({
                resourceType: "github:token",
                resourceId: "access_token",
                lastEtag: accessToken, // Using lastEtag to store the token (encrypted in production)
                syncStatus: "idle",
                createdAt: now,
                updatedAt: now,
              })
              .link({ user: userId }),
          )

          console.log(`GitHub connected for user ${userId} (${githubUser.login})`)

          // Redirect back to the app
          return new Response(null, {
            status: 302,
            headers: {
              Location: "/?github=connected",
            },
          })
        } catch (err) {
          console.error("GitHub OAuth callback error:", err)
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
