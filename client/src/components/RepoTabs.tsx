import { Link } from "wouter"
import { useQuery } from "@rocicorp/zero/react"
import {
  CodeIcon,
  GitPullRequestIcon,
  IssueOpenedIcon,
} from "@primer/octicons-react"
import { queries } from "@/db/queries"
import styles from "./RepoTabs.module.css"

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
    <nav className={styles.tabs}>
      {/* Code Tab */}
      <Link
        href={`/${fullName}`}
        className={`${styles.tab} ${activeTab === "code" ? styles.tabActive : ""}`}
      >
        <CodeIcon className={styles.tabIcon} size={16} />
        Code
      </Link>

      {/* Pull Requests Tab */}
      <Link
        href={`/${fullName}/pulls`}
        className={`${styles.tab} ${activeTab === "pulls" ? styles.tabActive : ""}`}
      >
        <GitPullRequestIcon className={styles.tabIcon} size={16} />
        Pull Requests
        {openPRs.length > 0 && (
          <span className={styles.tabCount}>{openPRs.length}</span>
        )}
      </Link>

      {/* Issues Tab */}
      <Link
        href={`/${fullName}/issues`}
        className={`${styles.tab} ${activeTab === "issues" ? styles.tabActive : ""}`}
      >
        <IssueOpenedIcon className={styles.tabIcon} size={16} />
        Issues
      </Link>
    </nav>
  )
}
