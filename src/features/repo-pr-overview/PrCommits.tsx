import { GitCommitIcon } from "@primer/octicons-react"
import { formatRelativeTime } from "@/lib/Format"
import { Avatar } from "@/components/Avatar"
import { db } from "@/lib/InstantDb"
import { mapPrToCard } from "./MapPrToCard"
import type { PullRequestCard } from "./Types"
import styles from "./PrCommits.module.css"

interface PrCommitsProps {
  owner: string
  repo: string
  prNumber: number
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

export function PrCommits({ owner, repo, prNumber }: PrCommitsProps) {
  const fullName = `${owner}/${repo}`

  const { data } = db.useQuery({
    repos: {
      $: { where: { fullName }, limit: 1 },
      pullRequests: {
        $: { where: { number: prNumber }, limit: 1 },
        pullRequestCommits: {
          $: { order: { updatedAt: "desc" }, limit: 50 },
        },
      },
    },
  })

  const rawPr = data?.repos?.[0]?.pullRequests?.[0]
  const pr = rawPr ? mapPrToCard(rawPr) : null
  const commits = (pr?.pullRequestCommits ?? []).toSorted(
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
