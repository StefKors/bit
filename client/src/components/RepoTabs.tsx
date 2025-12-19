import { Link } from "wouter"
import { useQuery } from "@rocicorp/zero/react"
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
        <svg
          className={styles.tabIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        Code
      </Link>

      {/* Pull Requests Tab */}
      <Link
        href={`/${fullName}/pulls`}
        className={`${styles.tab} ${activeTab === "pulls" ? styles.tabActive : ""}`}
      >
        <svg
          className={styles.tabIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="18" cy="18" r="3" />
          <circle cx="6" cy="6" r="3" />
          <path d="M13 6h3a2 2 0 0 1 2 2v7" />
          <line x1="6" y1="9" x2="6" y2="21" />
        </svg>
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
        <svg
          className={styles.tabIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        Issues
      </Link>
    </nav>
  )
}
