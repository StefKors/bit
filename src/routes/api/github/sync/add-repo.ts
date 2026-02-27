import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod/v4"
import { createGitHubClient, isGitHubAuthError, handleGitHubAuthError } from "@/lib/github-client"
import { log } from "@/lib/logger"

const addRepoBodySchema = z.object({
  url: z.string().min(1, "url is required"),
})

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

/**
 * Parses a GitHub URL into owner/repo.
 * Accepts:
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo/anything/else
 *   github.com/owner/repo
 *   owner/repo
 */
function parseGitHubUrl(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim().replace(/\/+$/, "")

  const urlPattern = /(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+)/
  const match = trimmed.match(urlPattern)
  if (match) {
    return { owner: match[1], repo: match[2].replace(/\.git$/, "") }
  }

  const shortPattern = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/
  const shortMatch = trimmed.match(shortPattern)
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2] }
  }

  return null
}

export const Route = createFileRoute("/api/github/sync/add-repo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("Authorization")
        const userId = authHeader?.replace("Bearer ", "") || ""

        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        const bodyResult = addRepoBodySchema.safeParse(await request.json())
        if (!bodyResult.success) {
          return jsonResponse(
            { error: "Invalid request body", details: bodyResult.error.message },
            400,
          )
        }

        const parsed = parseGitHubUrl(bodyResult.data.url)
        if (!parsed) {
          return jsonResponse(
            {
              error: "Invalid GitHub URL",
              details:
                'Expected a GitHub URL like "https://github.com/owner/repo" or "owner/repo".',
            },
            400,
          )
        }

        const client = await createGitHubClient(userId)
        if (!client) {
          return jsonResponse({ error: "GitHub account not connected" }, 400)
        }

        try {
          const [prsResult, webhookResult] = await Promise.all([
            client.fetchPullRequests(parsed.owner, parsed.repo, "open"),
            client.registerRepoWebhook(parsed.owner, parsed.repo),
          ])

          return jsonResponse({
            owner: parsed.owner,
            repo: parsed.repo,
            pullRequests: prsResult.data.length,
            webhookStatus: webhookResult.status,
            rateLimit: prsResult.rateLimit,
          })
        } catch (error) {
          log.error("Error adding repo", error, {
            op: "sync-add-repo",
            userId,
            owner: parsed.owner,
            repo: parsed.repo,
          })

          if (isGitHubAuthError(error)) {
            await handleGitHubAuthError(userId)
            return jsonResponse(
              {
                error: "GitHub authentication expired",
                code: "auth_invalid",
                details:
                  "Your GitHub token is no longer valid. Please reconnect your GitHub account.",
              },
              401,
            )
          }

          if (error && typeof error === "object" && "status" in error) {
            const status = (error as { status: number }).status
            if (status === 404) {
              return jsonResponse(
                {
                  error: "Repository not found",
                  details: `Could not find ${parsed.owner}/${parsed.repo}. It may not exist, be private, or your token may not have access.`,
                },
                404,
              )
            }
          }

          return jsonResponse(
            {
              error: "Failed to add repository",
              details: error instanceof Error ? error.message : "Unknown error",
            },
            500,
          )
        }
      },
    },
  },
})
