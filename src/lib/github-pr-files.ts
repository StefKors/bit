import { id } from "@instantdb/admin"
import { adminDb } from "@/lib/instantAdmin"
import { getInstallationToken } from "@/lib/github-app"
import { log } from "@/lib/logger"

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

interface PrResponse {
  base: { sha: string }
  head: { sha: string }
}

interface CommitEntry {
  sha: string
  commit: { message: string }
}

const GITHUB_API = "https://api.github.com"

const GITHUB_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
}

const githubFetch = async <T>(url: string, token: string): Promise<T | null> => {
  const response = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      ...GITHUB_HEADERS,
    },
  })
  if (!response.ok) {
    log.error("GitHub API request failed", `HTTP ${response.status}: ${url}`)
    return null
  }
  return (await response.json()) as T
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

export const fetchPRFiles = async (
  installationId: number,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<{ files: CompareFile[]; baseSha: string; headSha: string } | null> => {
  const token = await getInstallationToken(installationId)
  if (!token) return null

  const prUrl = `${GITHUB_API}/repos/${owner}/${repo}/pulls/${pullNumber}`
  const pr = await githubFetch<PrResponse>(prUrl, token)
  if (!pr) return null

  const files = await fetchFilesForCommit(installationId, owner, repo, pr.base.sha, pr.head.sha)
  return { files, baseSha: pr.base.sha, headSha: pr.head.sha }
}

export const fetchPRCommits = async (
  installationId: number,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<CommitEntry[]> => {
  const token = await getInstallationToken(installationId)
  if (!token) return []

  const url = `${GITHUB_API}/repos/${owner}/${repo}/pulls/${pullNumber}/commits?per_page=100`
  const data = await githubFetch<CommitEntry[]>(url, token)
  return data ?? []
}

export const syncPRFilesForCommit = async (
  pullRequestId: string,
  installationId: number,
  owner: string,
  repo: string,
  baseSha: string,
  commitSha: string,
): Promise<void> => {
  const files = await fetchFilesForCommit(installationId, owner, repo, baseSha, commitSha)
  if (files.length === 0) return

  const { pullRequestFiles: existing } = await adminDb.query({
    pullRequestFiles: {
      $: {
        where: {
          commitSha,
          "pullRequest.id": pullRequestId,
        },
      },
    },
  })

  const now = Date.now()

  const deleteTxs = (existing ?? []).map((f) => adminDb.tx.pullRequestFiles[f.id].delete())
  if (deleteTxs.length > 0) {
    await adminDb.transact(deleteTxs)
  }

  const insertTxs = files.map((file) => {
    const fileId = id()
    return adminDb.tx.pullRequestFiles[fileId]
      .update({
        commitSha,
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
    await adminDb.transact(insertTxs)
  }
}
