import { useState, useEffect, useMemo, useRef } from "react"
import { useMutation } from "@tanstack/react-query"
import { FileDirectoryIcon } from "@primer/octicons-react"
import { db } from "@/lib/instantDb"
import { useAuth } from "@/lib/hooks/useAuth"
import { syncTreeMutation } from "@/lib/mutations"
import { Markdown } from "@/components/Markdown"
import { FileTree, type TreeEntry } from "./FileTree"
import styles from "./RepoCodeTab.module.css"

interface RepoCodeTabProps {
  fullName: string
  repoId: string
  defaultBranch: string
  webhookStatus?: string | null
}

interface TreeEntryData {
  id: string
  path: string
  name: string
  type: string
  sha: string
  size?: number
}

export function RepoCodeTab({ fullName, repoId, defaultBranch, webhookStatus }: RepoCodeTabProps) {
  const { user } = useAuth()
  const [owner, repo] = fullName.split("/")
  const branch = defaultBranch || "main"

  const treeSync = useMutation(syncTreeMutation(user?.id ?? "", owner, repo, branch))
  const syncing = treeSync.isPending

  const [readme, setReadme] = useState<string | null>(null)
  const [readmeLoading, setReadmeLoading] = useState(false)
  const initialSyncTriggered = useRef(false)

  const { data: repoData, isLoading: treeLoading } = db.useQuery({
    repos: {
      $: { where: { id: repoId }, limit: 1 },
      repoTrees: {
        $: { where: { ref: branch }, order: { path: "asc" } },
      },
    },
  })

  const treeEntries = useMemo<TreeEntryData[]>(() => {
    const data = (repoData as { repos?: Array<{ repoTrees?: TreeEntryData[] }> } | undefined)?.repos
    return data?.[0]?.repoTrees ?? []
  }, [repoData])

  // Auto-sync files on first visit when webhooks are installed but tree is empty
  const hasWebhooks = webhookStatus === "installed"
  const treeIsEmpty = repoData !== undefined && treeEntries.length === 0
  if (hasWebhooks && treeIsEmpty && user?.id && !initialSyncTriggered.current && !syncing) {
    initialSyncTriggered.current = true
    treeSync.mutate()
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
      headers: {
        Authorization: `Bearer ${user?.id}`,
      },
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
  }, [treeEntries, owner, repo, branch, user?.id])

  // Convert query result to TreeEntry array
  const entries: TreeEntry[] = treeEntries.map((entry) => ({
    id: entry.id,
    path: entry.path,
    name: String(entry.name ?? ""),
    type: entry.type as "file" | "dir",
    sha: entry.sha,
    size: entry.size ?? null,
  }))

  return (
    <div className={styles.content}>
      <FileTree
        entries={entries}
        owner={owner}
        repo={repo}
        branch={branch}
        onSync={() => treeSync.mutate()}
        syncing={syncing}
        isLoading={treeLoading}
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
              <Markdown content={readme || ""} repoContext={{ owner, repo, branch }} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
