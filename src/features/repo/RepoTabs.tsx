import { useQuery } from "@rocicorp/zero/react"
import {
  CodeIcon,
  GitPullRequestIcon,
  IssueOpenedIcon,
} from "@primer/octicons-react"
import { queries } from "@/db/queries"
import { Tabs } from "@/components/Tabs"

type TabType = "code" | "pulls" | "issues"

interface RepoTabsProps {
  repoId: string
  fullName: string
  activeTab: TabType
}

export function RepoTabs({ repoId, fullName, activeTab }: RepoTabsProps) {
  const [prs] = useQuery(queries.pullRequests(repoId))
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
