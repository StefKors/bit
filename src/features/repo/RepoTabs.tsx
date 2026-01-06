import { CodeIcon, GitPullRequestIcon, IssueOpenedIcon } from "@primer/octicons-react"
import { Tabs } from "@/components/Tabs"
import type { InstaQLEntity } from "@instantdb/core"
import type { AppSchema } from "@/instant.schema"

type GithubPullRequest = InstaQLEntity<AppSchema, "pullRequests">
type GithubIssue = InstaQLEntity<AppSchema, "issues">

type TabType = "code" | "pulls" | "issues"

interface RepoTabsProps {
  prs: readonly GithubPullRequest[]
  issues: readonly GithubIssue[]
  fullName: string
  activeTab: TabType
}

export function RepoTabs({ prs, issues, fullName, activeTab }: RepoTabsProps) {
  const openPRs = prs.filter((pr) => pr.state === "open")
  const openIssues = issues.filter((issue) => issue.state === "open")
  const [owner, repo] = fullName.split("/")

  return (
    <Tabs
      value={activeTab}
      items={[
        {
          value: "code",
          label: "Code",
          icon: <CodeIcon size={16} />,
          to: "/$owner/$repo",
          params: { owner, repo },
        },
        {
          value: "pulls",
          label: "Pull Requests",
          icon: <GitPullRequestIcon size={16} />,
          count: openPRs.length,
          to: "/$owner/$repo/pulls",
          params: { owner, repo },
        },
        {
          value: "issues",
          label: "Issues",
          icon: <IssueOpenedIcon size={16} />,
          count: openIssues.length,
          to: "/$owner/$repo/issues",
          params: { owner, repo },
        },
      ]}
    />
  )
}
