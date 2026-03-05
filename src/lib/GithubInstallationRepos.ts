import { getInstallationToken, getAllInstallationIdsForUser } from "@/lib/GithubApp"
import { log } from "@/lib/Logger"

export interface InstallationRepo {
  id: number
  nodeId: string
  fullName: string
  name: string
  owner: string
  private: boolean
  description: string | null
  htmlUrl: string
  pushedAt: string | null
  stargazersCount: number
  forksCount: number
  language: string | null
  defaultBranch: string
}

interface GitHubRepo {
  id: number
  node_id: string
  full_name: string
  name: string
  owner: { login: string }
  private: boolean
  description: string | null
  html_url: string
  pushed_at: string | null
  stargazers_count: number
  forks_count: number
  language: string | null
  default_branch: string
}

interface InstallationReposResponse {
  total_count: number
  repositories: GitHubRepo[]
}

async function fetchInstallationReposPage(
  token: string,
  page: number,
): Promise<InstallationReposResponse> {
  const response = await fetch(
    `https://api.github.com/installation/repositories?per_page=100&page=${page}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  )

  if (!response.ok) {
    const body = await response.text()
    log.error("Failed to fetch installation repos", `HTTP ${response.status}: ${body}`)
    throw new Error(`GitHub API error: ${response.status}`)
  }

  return (await response.json()) as InstallationReposResponse
}

function toInstallationRepo(r: GitHubRepo): InstallationRepo {
  return {
    id: r.id,
    nodeId: r.node_id,
    fullName: r.full_name,
    name: r.name,
    owner: r.owner.login,
    private: r.private,
    description: r.description,
    htmlUrl: r.html_url,
    pushedAt: r.pushed_at,
    stargazersCount: r.stargazers_count,
    forksCount: r.forks_count,
    language: r.language,
    defaultBranch: r.default_branch,
  }
}

async function listReposForInstallation(installationId: number): Promise<InstallationRepo[]> {
  const token = await getInstallationToken(installationId)
  if (!token) {
    log.warn("listReposForInstallation: no token", { installationId })
    return []
  }

  const repos: InstallationRepo[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const data = await fetchInstallationReposPage(token, page)
    repos.push(...data.repositories.map(toInstallationRepo))
    hasMore = repos.length < data.total_count && data.repositories.length === 100
    page++
  }

  return repos
}

export async function listInstallationRepos(userId: string): Promise<InstallationRepo[]> {
  const installationIds = await getAllInstallationIdsForUser(userId)
  if (installationIds.length === 0) return []

  const results = await Promise.all(installationIds.map(listReposForInstallation))
  const allRepos = results.flat()

  const seen = new Set<number>()
  const deduped = allRepos.filter((r) => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })

  return [...deduped].sort((a, b) => {
    const aPushed = a.pushedAt ? new Date(a.pushedAt).getTime() : 0
    const bPushed = b.pushedAt ? new Date(b.pushedAt).getTime() : 0
    return bPushed - aPushed
  })
}
