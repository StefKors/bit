import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { adminDb } from "@/lib/instantAdmin"
import { toggleViewedFile } from "@/lib/pr-viewed-files"
import { log } from "@/lib/logger"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const viewedSchema = z.object({
  path: z.string().min(1),
})

const getUserId = (request: Request): string =>
  request.headers.get("Authorization")?.replace("Bearer ", "") || ""

const parseViewedFilesList = (raw: string | null | undefined): string[] => {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Array<string | number | boolean | null>
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === "string")
  } catch {
    return []
  }
}

const updateViewedFiles = async (params: {
  owner: string
  repo: string
  pullNumber: number
  userId: string
  path: string
  viewed: boolean
}): Promise<string[] | null> => {
  const fullName = `${params.owner}/${params.repo}`
  const { repos } = await adminDb.query({
    repos: {
      $: {
        where: {
          fullName,
          userId: params.userId,
        },
        limit: 1,
      },
    },
  })
  const repoRecord = repos?.[0]
  if (!repoRecord) return null

  const { pullRequests } = await adminDb.query({
    pullRequests: {
      $: {
        where: {
          number: params.pullNumber,
          repoId: repoRecord.id,
        },
        limit: 1,
      },
    },
  })
  const pr = pullRequests?.[0]
  if (!pr) return null

  const existingViewedFiles = parseViewedFilesList(pr.viewedFiles)
  const nextViewedFiles = toggleViewedFile(existingViewedFiles, params.path, params.viewed)
  await adminDb.transact(
    adminDb.tx.pullRequests[pr.id].update({
      viewedFiles: JSON.stringify(nextViewedFiles),
      updatedAt: Date.now(),
    }),
  )

  return nextViewedFiles
}

export const Route = createFileRoute("/api/github/viewed/$owner/$repo/$number")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const userId = getUserId(request)
        if (!userId) return jsonResponse({ error: "Unauthorized", code: "auth_missing" }, 401)

        const pullNumber = parseInt((params as { number: string }).number, 10)
        if (Number.isNaN(pullNumber))
          return jsonResponse({ error: "Invalid pull request number" }, 400)

        let body: object
        try {
          body = (await request.json()) as object
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400)
        }

        const parsed = viewedSchema.safeParse(body)
        if (!parsed.success)
          return jsonResponse({ error: "Invalid request body", details: parsed.error.issues }, 400)

        const { owner, repo } = params as { owner: string; repo: string }
        try {
          const viewedFiles = await updateViewedFiles({
            owner,
            repo,
            pullNumber,
            userId,
            path: parsed.data.path,
            viewed: true,
          })
          if (!viewedFiles)
            return jsonResponse({ error: "Pull request not found", code: "not_found" }, 404)
          return jsonResponse({ viewedFiles, path: parsed.data.path, viewed: true })
        } catch (error) {
          log.error("Unexpected viewed-file update error", error, {
            owner,
            repo,
            pullNumber,
            path: parsed.data.path,
          })
          return jsonResponse({ error: "Internal server error", code: "internal_error" }, 500)
        }
      },

      DELETE: async ({ request, params }) => {
        const userId = getUserId(request)
        if (!userId) return jsonResponse({ error: "Unauthorized", code: "auth_missing" }, 401)

        const pullNumber = parseInt((params as { number: string }).number, 10)
        if (Number.isNaN(pullNumber))
          return jsonResponse({ error: "Invalid pull request number" }, 400)

        let body: object
        try {
          body = (await request.json()) as object
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400)
        }

        const parsed = viewedSchema.safeParse(body)
        if (!parsed.success)
          return jsonResponse({ error: "Invalid request body", details: parsed.error.issues }, 400)

        const { owner, repo } = params as { owner: string; repo: string }
        try {
          const viewedFiles = await updateViewedFiles({
            owner,
            repo,
            pullNumber,
            userId,
            path: parsed.data.path,
            viewed: false,
          })
          if (!viewedFiles)
            return jsonResponse({ error: "Pull request not found", code: "not_found" }, 404)
          return jsonResponse({ viewedFiles, path: parsed.data.path, viewed: false })
        } catch (error) {
          log.error("Unexpected viewed-file update error", error, {
            owner,
            repo,
            pullNumber,
            path: parsed.data.path,
          })
          return jsonResponse({ error: "Internal server error", code: "internal_error" }, 500)
        }
      },
    },
  },
})
