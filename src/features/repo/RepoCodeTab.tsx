import { useState, useEffect } from "react"
import { useQuery } from "@rocicorp/zero/react"
import { FileDirectoryIcon } from "@primer/octicons-react"
import { queries } from "@/db/queries"
import { Markdown } from "@/components/Markdown"
import { FileTree, type TreeEntry } from "./FileTree"
import styles from "./RepoCodeTab.module.css"

interface RepoCodeTabProps {
  fullName: string
  repoId: string
  defaultBranch: string
}

export function RepoCodeTab({ fullName, repoId, defaultBranch }: RepoCodeTabProps) {
  const [owner, repo] = fullName.split("/")
  const branch = defaultBranch || "main"

  const [syncing, setSyncing] = useState(false)
  const [readme, setReadme] = useState<string | null>(null)
  const [readmeLoading, setReadmeLoading] = useState(false)

  // Query the tree entries
  const [treeEntries] = useQuery(queries.repoTree({ repoId, ref: branch }))

  const handleSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch(`/api/github/sync/${owner}/${repo}/tree?ref=${branch}`, {
        method: "POST",
        credentials: "include",
      })

      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        throw new Error(data.error || "Failed to sync")
      }
    } catch (err) {
      console.error("Error syncing tree:", err)
    } finally {
      setSyncing(false)
    }
  }

  // Fetch README when tree is loaded
  useEffect(() => {
    if (!treeEntries || treeEntries.length === 0) return

    // Find README file (case-insensitive)
    const readmeFile = treeEntries.find((entry) =>
      entry.name.toLowerCase().match(/^readme(\.(md|mdx|txt|rst))?$/),
    )

    if (!readmeFile) {
      setReadme(null)
      return
    }

    let cancelled = false
    setReadmeLoading(true)

    fetch(`/api/github/readme/${owner}/${repo}?ref=${branch}`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data: { content: string | null }) => {
        if (!cancelled) {
          setReadme(data.content)
        }
      })
      .catch((err) => {
        console.error("Error fetching README:", err)
        if (!cancelled) {
          setReadme(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setReadmeLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [treeEntries, owner, repo, branch])

  // Convert query result to TreeEntry array
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

  return (
    <div className={styles.content}>
      <FileTree
        entries={entries}
        owner={owner}
        repo={repo}
        branch={branch}
        onSync={() => void handleSync()}
        syncing={syncing}
      />

      {Boolean(readme) && (
        <div className={styles.readmeContainer}>
          <div className={styles.readmeHeader}>
            <FileDirectoryIcon size={16} />
            <span>README.md</span>
          </div>
          <div className={styles.readmeContent}>
            {readmeLoading ? (
              <div className={styles.readmeLoading}>Loading README...</div>
            ) : (
              <Markdown content={readme || ""} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
