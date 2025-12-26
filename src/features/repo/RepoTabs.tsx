import { CodeIcon, GitPullRequestIcon, IssueOpenedIcon } from "@primer/octicons-react"
import { Tabs } from "@/components/Tabs"
import type { GithubPullRequest } from "@/db/schema"

type TabType = "code" | "pulls" | "issues"

interface RepoTabsProps {
  prs: readonly GithubPullRequest[]
  fullName: string
  activeTab: TabType
}

export function RepoTabs({ prs, fullName, activeTab }: RepoTabsProps) {
  const openPRs = prs.filter((pr) => pr.state === "open")

  return (
    <Tabs
      value={activeTab}
      items={[
        {
          value: "code",
          label: "Code",
          icon: <CodeIcon size={16} />,
          href: `/${fullName}`,
        },
        {
          value: "pulls",
          label: "Pull Requests",
          icon: <GitPullRequestIcon size={16} />,
          count: openPRs.length,
          href: `/${fullName}/pulls`,
        },
        {
          value: "issues",
          label: "Issues",
          icon: <IssueOpenedIcon size={16} />,
          href: `/${fullName}/issues`,
        },
      ]}
    />
  )
}
