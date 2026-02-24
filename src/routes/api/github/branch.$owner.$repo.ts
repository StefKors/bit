import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { createGitHubClient, handleGitHubAuthError, isGitHubAuthError } from "@/lib/github-client"
import { log } from "@/lib/logger"
import { RequestError } from "octokit"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const deleteBranchSchema = z.object({
  branch: z.string().min(1),
})

const restoreBranchSchema = z.object({
  branch: z.string().min(1),
  sha: z.string().min(7),
})

const getUserId = (request: Request): string =>
  request.headers.get("Authorization")?.replace("Bearer ", "") || ""

export const Route = createFileRoute("/api/github/branch/$owner/$repo")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const userId = getUserId(request)
        if (!userId) {
          return jsonResponse({ error: "Unauthorized", code: "auth_missing" }, 401)
        }

        let body: object
        try {
          body = (await request.json()) as object
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400)
        }

        const parseResult = deleteBranchSchema.safeParse(body)
        if (!parseResult.success) {
          return jsonResponse(
            { error: "Invalid request body", details: parseResult.error.issues },
            400,
          )
        }

        const client = await createGitHubClient(userId)
        if (!client) {
          return jsonResponse({ error: "GitHub connection not found", code: "auth_invalid" }, 401)
        }

        const { owner, repo } = params as { owner: string; repo: string }
        try {
          const result = await client.deleteBranch(owner, repo, parseResult.data.branch)
          log.info("Branch deleted", { owner, repo, branch: parseResult.data.branch, userId })
          return jsonResponse(result)
        } catch (error) {
          if (isGitHubAuthError(error)) {
            await handleGitHubAuthError(userId)
            return jsonResponse(
              { error: "GitHub authentication expired", code: "auth_invalid" },
              401,
            )
          }

          if (error instanceof RequestError) {
            if (error.status === 404) {
              return jsonResponse({ error: "Branch not found", code: "not_found" }, 404)
            }
            if (error.status === 422) {
              return jsonResponse(
                { error: error.message || "Unable to delete branch", code: "unprocessable" },
                422,
              )
            }
            return jsonResponse(
              { error: error.message || "GitHub API error", code: "github_error" },
              error.status || 500,
            )
          }

          log.error("Unexpected error deleting branch", error, { owner, repo, userId })
          return jsonResponse({ error: "Internal server error", code: "internal_error" }, 500)
        }
      },

      POST: async ({ request, params }) => {
        const userId = getUserId(request)
        if (!userId) {
          return jsonResponse({ error: "Unauthorized", code: "auth_missing" }, 401)
        }

        let body: object
        try {
          body = (await request.json()) as object
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400)
        }

        const parseResult = restoreBranchSchema.safeParse(body)
        if (!parseResult.success) {
          return jsonResponse(
            { error: "Invalid request body", details: parseResult.error.issues },
            400,
          )
        }

        const client = await createGitHubClient(userId)
        if (!client) {
          return jsonResponse({ error: "GitHub connection not found", code: "auth_invalid" }, 401)
        }

        const { owner, repo } = params as { owner: string; repo: string }
        try {
          const result = await client.restoreBranch(
            owner,
            repo,
            parseResult.data.branch,
            parseResult.data.sha,
          )
          log.info("Branch restored", {
            owner,
            repo,
            branch: parseResult.data.branch,
            sha: parseResult.data.sha,
            userId,
          })
          return jsonResponse(result)
        } catch (error) {
          if (isGitHubAuthError(error)) {
            await handleGitHubAuthError(userId)
            return jsonResponse(
              { error: "GitHub authentication expired", code: "auth_invalid" },
              401,
            )
          }

          if (error instanceof RequestError) {
            if (error.status === 404) {
              return jsonResponse(
                { error: "Repository or commit not found", code: "not_found" },
                404,
              )
            }
            if (error.status === 422) {
              return jsonResponse(
                { error: error.message || "Unable to restore branch", code: "unprocessable" },
                422,
              )
            }
            return jsonResponse(
              { error: error.message || "GitHub API error", code: "github_error" },
              error.status || 500,
            )
          }

          log.error("Unexpected error restoring branch", error, { owner, repo, userId })
          return jsonResponse({ error: "Internal server error", code: "internal_error" }, 500)
        }
      },
    },
  },
})
