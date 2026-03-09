import { FileIcon } from "@primer/octicons-react"
import { db } from "@/lib/InstantDb"
import { CommitSelector } from "./CommitSelector"
import { FileEntry } from "./FileEntry"
import { mapPrToCard } from "./MapPrToCard"
import styles from "./PrFilesChanged.module.css"

interface PrFilesChangedProps {
  owner: string
  repo: string
  prNumber: number
}

export function PrFilesChanged({ owner, repo, prNumber }: PrFilesChangedProps) {
  const fullName = `${owner}/${repo}`

  const { data } = db.useQuery({
    repos: {
      $: { where: { fullName }, limit: 1, fields: ["fullName"] },
      pullRequests: {
        $: { where: { number: prNumber }, limit: 1, fields: ["headSha"] },
        pullRequestFiles: {
          $: {
            fields: ["filename", "previousFilename", "status", "additions", "deletions", "patch"],
          },
        },
        pullRequestCommits: {
          $: {
            order: { updatedAt: "desc" },
            limit: 50,
            fields: ["sha", "messageShort"],
          },
        },
      },
    },
  })

  const rawPr = data?.repos?.[0]?.pullRequests?.[0]
  const pr = rawPr ? mapPrToCard(rawPr) : null
  const files = pr?.pullRequestFiles ?? []
  const hasFiles = files.length > 0

  const totalAdditions = files.reduce((sum, f) => sum + (f.additions ?? 0), 0)
  const totalDeletions = files.reduce((sum, f) => sum + (f.deletions ?? 0), 0)

  return (
    <div className={styles.filesChangedContainer}>
      <div className={styles.filesChangedToolbar}>
        <div className={styles.filesChangedStats}>
          <span className={styles.filesCount}>
            <FileIcon size={14} />
            {files.length} file{files.length !== 1 ? "s" : ""}
          </span>
          {Boolean(totalAdditions) && (
            <span className={styles.additionsStat}>+{totalAdditions}</span>
          )}
          {Boolean(totalDeletions) && (
            <span className={styles.deletionsStat}>-{totalDeletions}</span>
          )}
        </div>
        <CommitSelector commits={pr?.pullRequestCommits ?? []} selectedSha={pr?.headSha ?? ""} />
      </div>

      {!hasFiles && <div className={styles.placeholder}>No file changes available yet.</div>}

      {hasFiles && (
        <div className={styles.filesList}>
          {files.map((file) => (
            <FileEntry key={file.id} file={file} />
          ))}
        </div>
      )}
    </div>
  )
}
