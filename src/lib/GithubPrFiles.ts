import { id } from "@instantdb/admin"
import { adminDb } from "@/lib/InstantAdmin"
import { getInstallationToken } from "@/lib/GithubApp"
import { log } from "@/lib/Logger"

export interface CompareFile {
  filename: string
  previous_filename?: string
  status: string
  additions: number
  deletions: number
  patch?: string
}

interface CompareResponse {
  files?: CompareFile[]
}

const GITHUB_API = "https://api.github.com"

const GITHUB_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
}

const parseLinkNext = (linkHeader: string | null): string | null => {
  if (!linkHeader) return null
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
  return match?.[1] ?? null
}

export const fetchFilesForCommit = async (
  installationId: number,
  owner: string,
  repo: string,
  baseSha: string,
  commitSha: string,
): Promise<CompareFile[]> => {
  const token = await getInstallationToken(installationId)
  if (!token) return []

  const allFiles: CompareFile[] = []
  let url: string | null = `${GITHUB_API}/repos/${owner}/${repo}/compare/${baseSha}...${commitSha}`

  while (url) {
    const response = await fetch(url, {
      headers: {
        Authorization: `token ${token}`,
        ...GITHUB_HEADERS,
      },
    })
    if (!response.ok) {
      log.error("GitHub API request failed", `HTTP ${response.status}: ${url}`)
      break
    }
    const data = (await response.json()) as CompareResponse
    const files = data?.files ?? []
    allFiles.push(...files)

    const nextUrl = parseLinkNext(response.headers.get("Link"))
    if (nextUrl && files.length > 0) {
      url = nextUrl
    } else {
      url = null
    }
  }

  return allFiles
}

/**
 * Sync the full PR file diff (base...head) into InstantDB.
 * Replaces all existing file records for the PR so the UI always
 * reflects the latest comparison between the target branch and head.
 */
export const syncPRFiles = async (
  pullRequestId: string,
  installationId: number,
  owner: string,
  repo: string,
  baseSha: string,
  headSha: string,
): Promise<void> => {
  const files = await fetchFilesForCommit(installationId, owner, repo, baseSha, headSha)
  if (files.length === 0) return

  const { pullRequestFiles: existing } = await adminDb.query({
    pullRequestFiles: {
      $: {
        where: { "pullRequest.id": pullRequestId },
      },
    },
  })

  const now = Date.now()

  const deleteTxs = (existing ?? []).map((f) => adminDb.tx.pullRequestFiles[f.id].delete())
  if (deleteTxs.length > 0) {
    try {
      await adminDb.transact(deleteTxs)
    } catch (error) {
      log.error("Failed to delete existing pull request files", error, {
        pullRequestId,
        owner,
        repo,
        baseSha,
        headSha,
        existingCount: deleteTxs.length,
      })
      throw error
    }
  }

  const insertTxs = files.map((file) => {
    const fileId = id()
    return adminDb.tx.pullRequestFiles[fileId]
      .update({
        commitSha: headSha,
        filename: file.filename,
        previousFilename: file.previous_filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch,
        createdAt: now,
        updatedAt: now,
      })
      .link({ pullRequest: pullRequestId })
  })

  if (insertTxs.length > 0) {
    try {
      await adminDb.transact(insertTxs)
    } catch (error) {
      log.error("Failed to insert pull request files", error, {
        pullRequestId,
        owner,
        repo,
        baseSha,
        headSha,
        filesCount: insertTxs.length,
      })
      throw error
    }
  }
}
