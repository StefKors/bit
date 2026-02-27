import { Markdown } from "@/components/Markdown"
import styles from "./SuggestionBlock.module.css"

interface SuggestionParts {
  before: string
  suggestion: string
  after: string
}

const parseSuggestionBody = (body: string): SuggestionParts | null => {
  const match = body.match(/```suggestion\r?\n([\s\S]*?)```/m)
  if (!match || match.index == null) return null

  const fullMatch = match[0]
  const suggestion = match[1] ?? ""
  const before = body.slice(0, match.index).trim()
  const after = body.slice(match.index + fullMatch.length).trim()

  return {
    before,
    suggestion,
    after,
  }
}

interface SuggestionBlockProps {
  body: string
}

export const SuggestionBlock = ({ body }: SuggestionBlockProps) => {
  const parsed = parseSuggestionBody(body)
  if (!parsed) return <Markdown content={body} />

  return (
    <div className={styles.container}>
      {parsed.before.length > 0 && <Markdown content={parsed.before} />}
      <div className={styles.card}>
        <div className={styles.title}>Suggested change</div>
        <pre className={styles.codeBlock}>
          <code>{parsed.suggestion}</code>
        </pre>
      </div>
      {parsed.after.length > 0 && <Markdown content={parsed.after} />}
    </div>
  )
}
