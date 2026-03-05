import { GitCommitIcon } from "@primer/octicons-react"
import { formatRelativeTime } from "@/lib/Format"
import { Avatar } from "@/components/Avatar"
import type { PullRequestCard } from "./Types"
import styles from "./PrCommits.module.css"

interface PrCommitsProps {
  pr: PullRequestCard
}

const CommitRow = ({ commit }: { commit: PullRequestCard["pullRequestCommits"][number] }) => {
  const shortSha = commit.sha.slice(0, 7)
  const message = commit.messageShort ?? commit.message?.split("\n")[0] ?? ""

  return (
    <li className={styles.commitRow}>
      <div className={styles.commitMain}>
        {commit.authorLogin && (
          <Avatar src={commit.authorAvatarUrl} name={commit.authorLogin} size={16} />
        )}
        <span className={styles.commitMessage}>{message}</span>
      </div>
      <div className={styles.commitMeta}>
        <span className={styles.commitAuthor}>{commit.authorLogin ?? "unknown"}</span>
        <time className={styles.commitTime}>{formatRelativeTime(commit.authoredAt)}</time>
        {commit.htmlUrl ? (
          <a
            href={commit.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.commitSha}
          >
            <GitCommitIcon size={12} />
            {shortSha}
          </a>
        ) : (
          <code className={styles.commitShaPlain}>{shortSha}</code>
        )}
      </div>
    </li>
  )
}

export function PrCommits({ pr }: PrCommitsProps) {
  const commits = pr.pullRequestCommits.toSorted(
    (a, b) => (a.authoredAt ?? a.createdAt) - (b.authoredAt ?? b.createdAt),
  )

  return (
    <div className={styles.commitsContainer}>
      <div className={styles.commitsHeader}>
        <span className={styles.commitsCount}>
          <GitCommitIcon size={12} />
          {commits.length} commit{commits.length !== 1 ? "s" : ""}
        </span>
      </div>
      {commits.length === 0 ? (
        <div className={styles.placeholder}>No commits available yet.</div>
      ) : (
        <ol className={styles.commitList}>
          {commits.map((commit) => (
            <CommitRow key={commit.id} commit={commit} />
          ))}
        </ol>
      )}
    </div>
  )
}
