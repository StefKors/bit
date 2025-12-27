import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@rocicorp/zero/react"
import { FileIcon, FileDirectoryIcon } from "@primer/octicons-react"
import { queries } from "@/db/queries"
import { Breadcrumb } from "@/components/Breadcrumb"
import { RepoHeader } from "@/features/repo/RepoHeader"
import { FileTree, type TreeEntry } from "@/features/repo/FileTree"
import styles from "@/features/repo/FileViewerPage.module.css"
import layoutStyles from "@/features/repo/RepoLayout.module.css"

function TreePage() {
  const { owner, repo, branch, _splat: path } = Route.useParams()
  const fullName = `${owner}/${repo}`

  const [syncing, setSyncing] = useState(false)

  // Query the repo
  const [repoData] = useQuery(queries.repoWithPRs(fullName))

  // Query tree entries once we have repo
  const repoId = repoData?.id ?? ""
  const [treeEntries] = useQuery(queries.repoTree({ repoId, ref: branch }))

  const handleSync = async () => {
    setSyncing(true)
    try {
      await fetch(`/api/github/sync/${owner}/${repo}/tree?ref=${branch}`, {
        method: "POST",
        credentials: "include",
      })
    } catch (err) {
      console.error("Error syncing:", err)
    } finally {
      setSyncing(false)
    }
  }

  if (!repoData) {
    return (
      <div className={layoutStyles.container}>
        <div className={layoutStyles.emptyState}>
          <FileDirectoryIcon className={layoutStyles.emptyIcon} size={48} />
          <h3 className={layoutStyles.emptyTitle}>Repository not found</h3>
          <p className={layoutStyles.emptyText}>
            This repository hasn't been synced yet.{" "}
            <Link to="/">Go back to overview</Link>
          </p>
        </div>
      </div>
    )
  }

  // Convert tree entries to TreeEntry type
  const entries: TreeEntry[] = treeEntries
    ? treeEntries.map((entry) => ({
        id: entry.id,
        path: entry.path,
        name: entry.name,
        type: entry.type as "file" | "dir",
        sha: entry.sha,
        size: entry.size,
      }))
    : []

  // Get children of current directory
  const currentPath = path || ""
  const directoryEntries = entries
    .filter((entry) => {
      if (!currentPath) {
        // Root level - entries without /
        return !entry.path.includes("/")
      }
      // Check if entry is direct child of current path
      const relativePath = entry.path.slice(currentPath.length + 1)
      return (
        entry.path.startsWith(currentPath + "/") &&
        !relativePath.includes("/")
      )
    })
    .sort((a, b) => {
      // Directories first, then alphabetical
      if (a.type !== b.type) {
        return a.type === "dir" ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })

  // Build path breadcrumb
  const pathParts = currentPath ? currentPath.split("/") : []
  const dirName = pathParts[pathParts.length - 1] || repo

  return (
    <div className={layoutStyles.container}>
      <Breadcrumb
        items={[
          { label: "Repositories", to: "/" },
          { label: owner, to: "/$owner", params: { owner } },
          { label: repo, to: "/$owner/$repo", params: { owner, repo } },
        ]}
      />

      <RepoHeader repo={repoData} syncing={syncing} onSync={() => void handleSync()} />

      <div className={styles.layout}>
        <div className={styles.sidebar}>
          <FileTree
            entries={entries}
            owner={owner}
            repo={repo}
            branch={branch}
            currentPath={currentPath}
            variant="sidebar"
            onSync={() => void handleSync()}
            syncing={syncing}
          />
        </div>

        <div className={styles.main}>
          <PathBreadcrumb
            owner={owner}
            repo={repo}
            branch={branch}
            pathParts={pathParts}
          />

          <div className={styles.directoryContent}>
            <div className={styles.directoryHeader}>
              <FileDirectoryIcon size={16} />
              <span>{dirName}</span>
            </div>

            {directoryEntries.length === 0 ? (
              <div className={styles.loading}>
                {entries.length === 0
                  ? "No files synced yet"
                  : "Empty directory"}
              </div>
            ) : (
              <ul className={styles.directoryList}>
                {directoryEntries.map((entry) => (
                  <DirectoryItem
                    key={entry.id}
                    entry={entry}
                    owner={owner}
                    repo={repo}
                    branch={branch}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface DirectoryItemProps {
  entry: TreeEntry
  owner: string
  repo: string
  branch: string
}

function DirectoryItem({ entry, owner, repo, branch }: DirectoryItemProps) {
  const isDir = entry.type === "dir"
  const to = isDir
    ? "/$owner/$repo/tree/$branch/$"
    : "/$owner/$repo/blob/$branch/$"

  return (
    <li>
      <Link
        to={to}
        params={{ owner, repo, branch, _splat: entry.path }}
        className={styles.directoryItem}
      >
        {isDir ? (
          <FileDirectoryIcon
            className={`${styles.itemIcon} ${styles.itemIconFolder}`}
            size={16}
          />
        ) : (
          <FileIcon className={styles.itemIcon} size={16} />
        )}
        <span className={styles.itemName}>{entry.name}</span>
      </Link>
    </li>
  )
}

interface PathBreadcrumbProps {
  owner: string
  repo: string
  branch: string
  pathParts: string[]
}

function PathBreadcrumb({ owner, repo, branch, pathParts }: PathBreadcrumbProps) {
  return (
    <div className={styles.breadcrumbPath}>
      <Link
        to="/$owner/$repo"
        params={{ owner, repo }}
        className={styles.breadcrumbLink}
      >
        {repo}
      </Link>

      {pathParts.length > 0 && (
        <span className={styles.breadcrumbSeparator}>/</span>
      )}

      {pathParts.map((part, index) => {
        const isLast = index === pathParts.length - 1
        const pathUpToHere = pathParts.slice(0, index + 1).join("/")

        if (isLast) {
          return (
            <span key={index} className={styles.breadcrumbCurrent}>
              {part}
            </span>
          )
        }

        return (
          <span key={index}>
            <Link
              to="/$owner/$repo/tree/$branch/$"
              params={{ owner, repo, branch, _splat: pathUpToHere }}
              className={styles.breadcrumbLink}
            >
              {part}
            </Link>
            <span className={styles.breadcrumbSeparator}>/</span>
          </span>
        )
      })}
    </div>
  )
}

export const Route = createFileRoute("/$owner/$repo/tree/$branch/$")({
  component: TreePage,
})
