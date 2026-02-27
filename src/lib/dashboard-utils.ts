type PRLike = {
  id: string
  state: string
  draft?: boolean | null
  merged?: boolean | null
  authorLogin?: string | null
  githubCreatedAt?: number | null
  githubUpdatedAt?: number | null
  closedAt?: number | null
  mergedAt?: number | null
  reviewRequestedBy?: string | null
  prReviews?: Array<{
    id: string
    state: string
    authorLogin?: string | null
    submittedAt?: number | null
  }> | null
  prComments?: Array<{
    id: string
    authorLogin?: string | null
    body?: string | null
    githubCreatedAt?: number | null
  }> | null
  prCommits?: Array<{
    id: string
    sha: string
    message: string
    authorLogin?: string | null
    committedAt?: number | null
  }> | null
  prChecks?: Array<{
    id: string
    name: string
    status: string
    conclusion?: string | null
  }> | null
  repo?: { fullName: string } | null
}

type RepoLike = {
  id: string
  name: string
  fullName: string
  owner: string
  language?: string | null
  stargazersCount?: number | null
  forksCount?: number | null
  openIssuesCount?: number | null
  githubPushedAt?: number | null
  private?: boolean | null
  pullRequests?: PRLike[]
  issues?: Array<{
    id: string
    state: string
    title: string
    number: number
    authorLogin?: string | null
    githubCreatedAt?: number | null
    githubUpdatedAt?: number | null
  }>
}

export type ActivityItem = {
  id: string
  type: "pr_opened" | "pr_merged" | "pr_closed" | "review" | "comment" | "commit"
  title: string
  subtitle: string
  timestamp: number
  authorLogin?: string | null
  authorAvatarUrl?: string | null
  repoFullName?: string
  prNumber?: number
  metadata?: Record<string, string>
}

export type NextAction = {
  id: string
  type: "failing_ci" | "review_requested" | "stale_pr" | "draft_pr" | "open_issue"
  priority: "high" | "medium" | "low"
  title: string
  subtitle: string
  repoFullName?: string
  prNumber?: number
  issueNumber?: number
}

export const buildActivityFeed = (repos: RepoLike[], currentLogin: string): ActivityItem[] => {
  const items: ActivityItem[] = []

  for (const repo of repos) {
    const prs = repo.pullRequests ?? []
    for (const pr of prs) {
      if (pr.mergedAt && pr.authorLogin === currentLogin) {
        items.push({
          id: `merge-${pr.id}`,
          type: "pr_merged",
          title: `Merged PR #${(pr as { number?: number }).number ?? ""}`,
          subtitle: repo.fullName,
          timestamp: pr.mergedAt,
          authorLogin: pr.authorLogin,
          repoFullName: repo.fullName,
          prNumber: (pr as { number?: number }).number,
        })
      } else if (pr.githubCreatedAt && pr.authorLogin === currentLogin) {
        items.push({
          id: `open-${pr.id}`,
          type: "pr_opened",
          title: `Opened PR #${(pr as { number?: number }).number ?? ""}`,
          subtitle: repo.fullName,
          timestamp: pr.githubCreatedAt,
          authorLogin: pr.authorLogin,
          repoFullName: repo.fullName,
          prNumber: (pr as { number?: number }).number,
        })
      }

      const reviews = pr.prReviews ?? []
      for (const review of reviews) {
        if (review.submittedAt && review.authorLogin === currentLogin) {
          items.push({
            id: `review-${review.id}`,
            type: "review",
            title: `Reviewed PR #${(pr as { number?: number }).number ?? ""}`,
            subtitle: `${repo.fullName} — ${review.state.toLowerCase()}`,
            timestamp: review.submittedAt,
            authorLogin: review.authorLogin,
            repoFullName: repo.fullName,
            prNumber: (pr as { number?: number }).number,
            metadata: { state: review.state },
          })
        }
      }

      const comments = pr.prComments ?? []
      for (const comment of comments) {
        if (comment.githubCreatedAt && comment.authorLogin === currentLogin) {
          items.push({
            id: `comment-${comment.id}`,
            type: "comment",
            title: `Commented on PR #${(pr as { number?: number }).number ?? ""}`,
            subtitle: repo.fullName,
            timestamp: comment.githubCreatedAt,
            authorLogin: comment.authorLogin,
            repoFullName: repo.fullName,
            prNumber: (pr as { number?: number }).number,
          })
        }
      }

      const commits = pr.prCommits ?? []
      for (const commit of commits) {
        if (commit.committedAt && commit.authorLogin === currentLogin) {
          items.push({
            id: `commit-${commit.id}`,
            type: "commit",
            title: commit.message.split("\n")[0],
            subtitle: repo.fullName,
            timestamp: commit.committedAt,
            authorLogin: commit.authorLogin,
            repoFullName: repo.fullName,
            prNumber: (pr as { number?: number }).number,
          })
        }
      }
    }
  }

  items.sort((a, b) => b.timestamp - a.timestamp)
  return items
}

export const buildNextActions = (repos: RepoLike[], currentLogin: string): NextAction[] => {
  const actions: NextAction[] = []
  const now = Date.now()
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000

  for (const repo of repos) {
    const prs = repo.pullRequests ?? []
    for (const pr of prs) {
      if (pr.state !== "open") continue
      const prNumber = (pr as { number?: number }).number
      const prTitle = (pr as { title?: string }).title ?? `PR #${prNumber}`

      const checks = pr.prChecks ?? []
      const hasFailingCI = checks.some(
        (c) =>
          c.status === "completed" && (c.conclusion === "failure" || c.conclusion === "timed_out"),
      )
      if (hasFailingCI && pr.authorLogin === currentLogin) {
        actions.push({
          id: `ci-${pr.id}`,
          type: "failing_ci",
          priority: "high",
          title: `CI failing on "${prTitle}"`,
          subtitle: repo.fullName,
          repoFullName: repo.fullName,
          prNumber,
        })
      }

      const reviewRequestedBy = pr.reviewRequestedBy
      if (reviewRequestedBy) {
        try {
          const reviewers = JSON.parse(reviewRequestedBy) as string[]
          if (Array.isArray(reviewers) && reviewers.includes(currentLogin)) {
            actions.push({
              id: `review-${pr.id}`,
              type: "review_requested",
              priority: "high",
              title: `Review requested: "${prTitle}"`,
              subtitle: `${repo.fullName} by ${pr.authorLogin ?? "unknown"}`,
              repoFullName: repo.fullName,
              prNumber,
            })
          }
        } catch {
          // invalid JSON, skip
        }
      }

      if (pr.draft && pr.authorLogin === currentLogin) {
        actions.push({
          id: `draft-${pr.id}`,
          type: "draft_pr",
          priority: "low",
          title: `Draft PR: "${prTitle}"`,
          subtitle: repo.fullName,
          repoFullName: repo.fullName,
          prNumber,
        })
      }

      const lastUpdate = pr.githubUpdatedAt ?? pr.githubCreatedAt ?? 0
      if (now - lastUpdate > ONE_WEEK && pr.authorLogin === currentLogin && !pr.draft) {
        actions.push({
          id: `stale-${pr.id}`,
          type: "stale_pr",
          priority: "medium",
          title: `Stale: "${prTitle}"`,
          subtitle: `${repo.fullName} — no activity in 7+ days`,
          repoFullName: repo.fullName,
          prNumber,
        })
      }
    }

    const issues = repo.issues ?? []
    for (const issue of issues) {
      if (issue.state !== "open") continue
      if (issue.authorLogin === currentLogin) {
        actions.push({
          id: `issue-${issue.id}`,
          type: "open_issue",
          priority: "low",
          title: `Issue #${issue.number}: ${issue.title}`,
          subtitle: repo.fullName,
          repoFullName: repo.fullName,
          issueNumber: issue.number,
        })
      }
    }
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 }
  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
  return actions
}

export const getLanguageDistribution = (
  repos: RepoLike[],
): Array<{ language: string; count: number; color: string }> => {
  const langCount: Record<string, number> = {}
  for (const repo of repos) {
    if (repo.language) {
      langCount[repo.language] = (langCount[repo.language] ?? 0) + 1
    }
  }

  const colors: Record<string, string> = {
    TypeScript: "#3178c6",
    JavaScript: "#f1e05a",
    Python: "#3572A5",
    Rust: "#dea584",
    Go: "#00ADD8",
    Java: "#b07219",
    Ruby: "#701516",
    "C++": "#f34b7d",
    C: "#555555",
    Swift: "#F05138",
    Kotlin: "#A97BFF",
    Shell: "#89e051",
    HTML: "#e34c26",
    CSS: "#563d7c",
    Dart: "#00B4AB",
    PHP: "#4F5D95",
    Scala: "#c22d40",
    Elixir: "#6e4a7e",
    Haskell: "#5e5086",
    Lua: "#000080",
    Zig: "#ec915c",
  }

  const fallbackColors = [
    "#7c8aff",
    "#ff7eb3",
    "#7afcff",
    "#ffd700",
    "#ff6b6b",
    "#98d8c8",
    "#c9b1ff",
  ]

  return Object.entries(langCount)
    .map(([language, count], idx) => ({
      language,
      count,
      color: colors[language] ?? fallbackColors[idx % fallbackColors.length],
    }))
    .sort((a, b) => b.count - a.count)
}

export const getDailyActivityCounts = (
  repos: RepoLike[],
  currentLogin: string,
  days: number = 28,
): Array<{ date: string; count: number }> => {
  const now = new Date()
  const counts: Record<string, number> = {}

  for (let i = 0; i < days; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    counts[key] = 0
  }

  for (const repo of repos) {
    const prs = repo.pullRequests ?? []
    for (const pr of prs) {
      const timestamps: number[] = []

      if (pr.githubCreatedAt && pr.authorLogin === currentLogin) timestamps.push(pr.githubCreatedAt)
      if (pr.mergedAt && pr.authorLogin === currentLogin) timestamps.push(pr.mergedAt)

      for (const review of pr.prReviews ?? []) {
        if (review.submittedAt && review.authorLogin === currentLogin)
          timestamps.push(review.submittedAt)
      }
      for (const comment of pr.prComments ?? []) {
        if (comment.githubCreatedAt && comment.authorLogin === currentLogin)
          timestamps.push(comment.githubCreatedAt)
      }
      for (const commit of pr.prCommits ?? []) {
        if (commit.committedAt && commit.authorLogin === currentLogin)
          timestamps.push(commit.committedAt)
      }

      for (const ts of timestamps) {
        const key = new Date(ts).toISOString().slice(0, 10)
        if (key in counts) {
          counts[key]++
        }
      }
    }
  }

  return Object.entries(counts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export const getGreeting = (): string => {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export const parseStringArray = (value: string | null | undefined): string[] => {
  if (!value) return []
  try {
    const parsed: string[] | string = JSON.parse(value) as string[] | string
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
