import type { PullRequestReaction } from "./Types"
import styles from "./TimelineReactions.module.css"

interface TimelineReactionsProps {
  reactions: PullRequestReaction[]
}

const REACTION_LABELS: Record<string, string> = {
  "+1": "👍",
  "-1": "👎",
  laugh: "😄",
  hooray: "🎉",
  confused: "😕",
  heart: "❤️",
  rocket: "🚀",
  eyes: "👀",
}

export const TimelineReactions = ({ reactions }: TimelineReactionsProps) => {
  const visibleReactions = reactions.filter((reaction) => reaction.count > 0)
  if (visibleReactions.length === 0) return null

  return (
    <div className={styles.reactionList}>
      {visibleReactions.map((reaction) => (
        <span key={reaction.id} className={styles.reactionPill}>
          <span>{REACTION_LABELS[reaction.content] ?? reaction.content}</span>
          <span>{reaction.count}</span>
        </span>
      ))}
    </div>
  )
}
