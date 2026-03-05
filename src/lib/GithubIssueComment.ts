import { getInstallationToken, getInstallationIdForUser } from "@/lib/GithubApp"
import { log } from "@/lib/Logger"

const GITHUB_API = "https://api.github.com"
const GITHUB_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
}

export async function createIssueComment(params: {
  userId: string
  owner: string
  repo: string
  issueNumber: number
  body: string
}): Promise<{ htmlUrl: string } | null> {
  const { userId, owner, repo, issueNumber, body } = params

  const installationId = await getInstallationIdForUser(userId)
  if (!installationId) {
    log.warn("createIssueComment: no installation for user", { userId })
    return null
  }

  const token = await getInstallationToken(installationId)
  if (!token) {
    log.warn("createIssueComment: no installation token", { installationId })
    return null
  }

  const url = `${GITHUB_API}/repos/${owner}/${repo}/issues/${issueNumber}/comments`
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...GITHUB_HEADERS,
      Authorization: `Bearer ${token}`,
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
