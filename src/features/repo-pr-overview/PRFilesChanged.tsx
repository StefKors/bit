import { useRef, useState } from "react"
import { FileIcon, SyncIcon } from "@primer/octicons-react"
import { db } from "@/lib/instantDb"
import { CommitSelector } from "./CommitSelector"
import { FileEntry } from "./FileEntry"
import type { PullRequestCard } from "./types"
import styles from "./PRFilesChanged.module.css"

interface CommitInfo {
  sha: string
  message: string
}

interface PRFilesChangedProps {
  pr: PullRequestCard
  owner: string
  repo: string
}

export function PRFilesChanged({ pr, owner, repo }: PRFilesChangedProps) {
  const { user: authUser } = db.useAuth()
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(null)
  const [commits, setCommits] = useState<CommitInfo[]>([])
  const [commitsLoading, setCommitsLoading] = useState(false)
  const [syncingCommit, setSyncingCommit] = useState<string | null>(null)
  const commitsFetchedRef = useRef<string | null>(null)

  const effectiveSha = selectedCommitSha ?? pr.headSha

  const refreshToken = authUser?.refresh_token

  const filesForSha = effectiveSha
    ? pr.pullRequestFiles.filter((f) => f.commitSha === effectiveSha)
    : []
  const hasFiles = filesForSha.length > 0

  const handleLoadCommits = () => {
    if (!refreshToken || commitsLoading || commitsFetchedRef.current === pr.id) return
    setCommitsLoading(true)
    commitsFetchedRef.current = pr.id
    fetch("/api/github/sync/pr-commits", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshToken}`,
      },
      body: JSON.stringify({ owner, repo, pullNumber: pr.number }),
    })
      .then((res) => res.json() as Promise<{ commits?: CommitInfo[] }>)
      .then((data) => {
        setCommits(data.commits ?? [])
      })
      .catch(() => {
        commitsFetchedRef.current = null
      })
      .finally(() => {
        setCommitsLoading(false)
      })
  }

  const handleSyncFiles = (sha: string) => {
    if (!refreshToken || syncingCommit) return
    setSyncingCommit(sha)
    fetch("/api/github/sync/pr-files", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshToken}`,
      },
      body: JSON.stringify({
        owner,
        repo,
        pullNumber: pr.number,
        commitSha: sha,
      }),
    })
      .catch(() => {})
      .finally(() => {
        setSyncingCommit(null)
      })
  }

  const handleCommitSelect = (sha: string) => {
    setSelectedCommitSha(sha)
    const filesExist = pr.pullRequestFiles.some((f) => f.commitSha === sha)
    if (!filesExist) {
      handleSyncFiles(sha)
    }
  }

  const totalAdditions = filesForSha.reduce((sum, f) => sum + (f.additions ?? 0), 0)
  const totalDeletions = filesForSha.reduce((sum, f) => sum + (f.deletions ?? 0), 0)

  return (
    <div className={styles.filesChangedContainer}>
      <div className={styles.filesChangedToolbar}>
        <div className={styles.filesChangedStats}>
          <span className={styles.filesCount}>
            <FileIcon size={14} />
            {filesForSha.length} file{filesForSha.length !== 1 ? "s" : ""}
          </span>
          {Boolean(totalAdditions) && (
            <span className={styles.additionsStat}>+{totalAdditions}</span>
          )}
          {Boolean(totalDeletions) && (
            <span className={styles.deletionsStat}>-{totalDeletions}</span>
          )}
        </div>
        <CommitSelector
          commits={commits}
          selectedSha={effectiveSha ?? ""}
          onSelect={handleCommitSelect}
          loading={commitsLoading}
        />
        {commits.length === 0 && !commitsLoading && (
          <button type="button" className={styles.loadCommitsButton} onClick={handleLoadCommits}>
            Load commits
          </button>
        )}
      </div>

      {Boolean(syncingCommit) && (
        <div className={styles.syncingBanner}>
          <SyncIcon size={14} className={styles.spinIcon} />
          Fetching files for {syncingCommit?.slice(0, 7)}…
        </div>
      )}

      {!hasFiles && !syncingCommit && (
        <div className={styles.placeholder}>
          {effectiveSha ? (
            <>
              No files cached for commit {effectiveSha.slice(0, 7)}.
              <button
                type="button"
                className={styles.loadCommitsButton}
                onClick={() => {
                  if (effectiveSha) handleSyncFiles(effectiveSha)
                }}
              >
                Fetch files
              </button>
            </>
          ) : (
            "No commit SHA available."
          )}
        </div>
      )}

      {hasFiles && (
        <div className={styles.filesList}>
          {filesForSha.map((file) => (
            <FileEntry key={file.id} file={file} />
          ))}
        </div>
      )}
    </div>
  )
}
