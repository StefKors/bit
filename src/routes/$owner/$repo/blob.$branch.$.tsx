import { useState, useEffect } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useMutation } from "@tanstack/react-query"
import { FileDirectoryIcon } from "@primer/octicons-react"
import { db } from "@/lib/instantDb"
import { useAuth } from "@/lib/hooks/useAuth"
import { syncTreeMutation } from "@/lib/mutations"
import { Breadcrumb } from "@/components/Breadcrumb"
import { RepoHeader } from "@/features/repo/RepoHeader"
import { FileTree, type TreeEntry } from "@/features/repo/FileTree"
import { FileViewer } from "@/features/repo/FileViewer"
import styles from "@/features/repo/FileViewerPage.module.css"
import layoutStyles from "@/features/repo/RepoLayout.module.css"

function BlobPage() {
  const { user } = useAuth()
  const { owner, repo, branch, _splat: path } = Route.useParams()
  const fullName = `${owner}/${repo}`

  const treeSync = useMutation(syncTreeMutation(user?.id ?? "", owner, repo, branch))
  const syncing = treeSync.isPending

  const [fileContent, setFileContent] = useState<string | null>(null)
  const [fileLoading, setFileLoading] = useState(true)
  const [fileError, setFileError] = useState<string | null>(null)

  // Query the repo with InstantDB
  const { data: reposData, isLoading } = db.useQuery({
    repos: {
      $: { where: { fullName } },
      organization: {},
      pullRequests: {},
      issues: {},
      repoTrees: {
        $: { where: { ref: branch } },
      },
    },
  })

  const repoData = reposData?.repos?.[0] ?? null
  const treeEntries = repoData?.repoTrees ?? []

  // Find current file in tree
  const currentFile = treeEntries.find((e) => e.path === path)

  // Fetch file content
  useEffect(() => {
    if (!path) return

    let cancelled = false
    setFileLoading(true)
    setFileError(null)

    fetch(`/api/github/file/${owner}/${repo}/${path}?ref=${branch}`, {
      credentials: "include",
      headers: {
        Authorization: `Bearer ${user?.id}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch file")
        return res.json()
      })
      .then((data: { content: string | null }) => {
        if (!cancelled) {
          setFileContent(data.content)
        }
      })
      .catch((err) => {
        console.error("Error fetching file:", err)
        if (!cancelled) {
          setFileError(err instanceof Error ? err.message : "Failed to load file")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setFileLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [owner, repo, path, branch, user?.id])

  const handleSync = () => treeSync.mutate()

  if (isLoading) {
    return (
      <div className={layoutStyles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    )
  }

  if (!repoData) {
    return (
      <div className={layoutStyles.container}>
        <div className={layoutStyles.emptyState}>
          <FileDirectoryIcon className={layoutStyles.emptyIcon} size={48} />
          <h3 className={layoutStyles.emptyTitle}>Repository not found</h3>
          <p className={layoutStyles.emptyText}>
            This repository hasn't been synced yet.{" "}
            <Link
              to="/"
              search={{
                github: undefined,
                error: undefined,
                message: undefined,
                revokeUrl: undefined,
              }}
            >
              Go back to overview
            </Link>
          </p>
        </div>
      </div>
    )
  }

  // Convert tree entries to TreeEntry type
  const entries: TreeEntry[] = treeEntries.map((entry) => ({
    id: entry.id,
    path: entry.path,
    name: String(entry.name ?? ""),
    type: entry.type as "file" | "dir",
    sha: entry.sha,
    size: entry.size ?? null,
  }))

  // Build path breadcrumb
  const pathParts = path?.split("/") || []
  const fileName = pathParts[pathParts.length - 1] || ""
  const htmlUrl = currentFile?.htmlUrl || `https://github.com/${fullName}/blob/${branch}/${path}`

  // Build repo data for RepoHeader
  const repoForHeader = {
    id: repoData.id,
    name: repoData.name,
    fullName: repoData.fullName,
    owner: repoData.owner,
    description: repoData.description,
    htmlUrl: repoData.htmlUrl,
    stargazersCount: repoData.stargazersCount,
    forksCount: repoData.forksCount,
    defaultBranch: repoData.defaultBranch,
    organization: repoData.organization ?? null,
    pullRequests: repoData.pullRequests ?? [],
    issues: repoData.issues ?? [],
  }

  return (
    <div className={layoutStyles.container}>
      <Breadcrumb
        items={[
          { label: "Repositories", to: "/" },
          { label: owner, to: "/$owner", params: { owner } },
          { label: repo, to: "/$owner/$repo", params: { owner, repo } },
        ]}
      />

      <RepoHeader repo={repoForHeader} syncing={syncing} onSync={handleSync} />

      <div className={styles.layout}>
        <div className={styles.sidebar}>
          <FileTree
            entries={entries}
            owner={owner}
            repo={repo}
            branch={branch}
            currentPath={path}
            variant="sidebar"
            onSync={handleSync}
            syncing={syncing}
          />
        </div>

        <div className={styles.main}>
          <PathBreadcrumb owner={owner} repo={repo} branch={branch} pathParts={pathParts} />

          <FileViewer
            filename={fileName}
            content={fileContent}
            size={currentFile?.size}
            htmlUrl={htmlUrl}
            loading={fileLoading}
            error={fileError}
          />
        </div>
      </div>
    </div>
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
      <Link to="/$owner/$repo" params={{ owner, repo }} className={styles.breadcrumbLink}>
        {repo}
      </Link>
      <span className={styles.breadcrumbSeparator}>/</span>

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

export const Route = createFileRoute("/$owner/$repo/blob/$branch/$")({
  component: BlobPage,
})
