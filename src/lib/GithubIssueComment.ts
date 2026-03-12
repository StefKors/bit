import { getInstallationIdForRepo, getInstallationToken, getUserGitHubToken } from "@/lib/GithubApp"
import { log } from "@/lib/Logger"

const GITHUB_API = "https://api.github.com"
const GITHUB_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
}

export type IssueCommentAuthSource = "user" | "installation"

export async function resolveIssueCommentAuth(
  userId: string,
  owner: string,
): Promise<{ token: string; source: IssueCommentAuthSource } | null> {
  const userToken = await getUserGitHubToken(userId)
  if (userToken) return { token: userToken, source: "user" }

  const installationId = await getInstallationIdForRepo(userId, owner)
  if (!installationId) {
    log.warn("resolveToken: no installation for user/owner", { userId, owner })
    return null
  }

  const installToken = await getInstallationToken(installationId)
  if (!installToken) {
    log.warn("resolveToken: no installation token", { installationId })
    return null
  }

  return { token: installToken, source: "installation" }
}

export async function createIssueComment(params: {
  userId: string
  owner: string
  repo: string
  issueNumber: number
  body: string
}): Promise<{ htmlUrl: string } | null> {
  const { userId, owner, repo, issueNumber, body } = params

  const auth = await resolveIssueCommentAuth(userId, owner)
  if (!auth) return null

  log.info("createIssueComment: posting as", { source: auth.source, userId })

  const url = `${GITHUB_API}/repos/${owner}/${repo}/issues/${issueNumber}/comments`
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...GITHUB_HEADERS,
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body }),
  })

  if (!response.ok) {
    const text = await response.text()
    log.warn("createIssueComment: GitHub API error", {
      url,
      status: response.status,
      body: text,
    })
    return null
  }

  const data = (await response.json()) as { html_url?: string }
  return { htmlUrl: data.html_url ?? "" }
}
