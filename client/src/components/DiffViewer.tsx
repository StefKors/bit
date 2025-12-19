import { useMemo } from "react"
import styles from "./DiffViewer.module.css"

interface DiffViewerProps {
  filename: string
  patch: string
  additions: number
  deletions: number
}

interface DiffLine {
  type: "addition" | "deletion" | "context" | "hunk"
  content: string
  oldLineNumber: number | null
  newLineNumber: number | null
}

function parsePatch(patch: string): DiffLine[] {
  const lines = patch.split("\n")
  const result: DiffLine[] = []

  let oldLine = 0
  let newLine = 0

  for (const line of lines) {
    if (line.startsWith("@@")) {
      // Parse hunk header: @@ -1,3 +1,4 @@
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (match) {
        oldLine = parseInt(match[1], 10)
        newLine = parseInt(match[2], 10)
      }
      result.push({
        type: "hunk",
        content: line,
        oldLineNumber: null,
        newLineNumber: null,
      })
    } else if (line.startsWith("+")) {
      result.push({
        type: "addition",
        content: line.slice(1),
        oldLineNumber: null,
        newLineNumber: newLine++,
      })
    } else if (line.startsWith("-")) {
      result.push({
        type: "deletion",
        content: line.slice(1),
        oldLineNumber: oldLine++,
        newLineNumber: null,
      })
    } else if (line.startsWith(" ") || line === "") {
      result.push({
        type: "context",
        content: line.slice(1) || "",
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
      })
    }
  }

  return result
}

export function DiffViewer({
  filename,
  patch,
  additions,
  deletions,
}: DiffViewerProps) {
  const diffLines = useMemo(() => parsePatch(patch), [patch])

  return (
    <div className={styles.container}>
      <table className={styles.diffTable}>
        <tbody>
          {diffLines.map((line, index) => {
            if (line.type === "hunk") {
              return (
                <tr key={index}>
                  <td colSpan={3} className={styles.hunk}>
                    {line.content}
                  </td>
                </tr>
              )
            }

            const lineClass =
              line.type === "addition"
                ? styles.lineAddition
                : line.type === "deletion"
                  ? styles.lineDeletion
                  : styles.lineContext

            return (
              <tr key={index} className={lineClass}>
                <td className={styles.lineNumber}>
                  {line.oldLineNumber ?? ""}
                </td>
                <td className={styles.lineNumber}>
                  {line.newLineNumber ?? ""}
                </td>
                <td className={styles.lineContent}>
                  <span className={styles.prefix}>
                    {line.type === "addition"
                      ? "+"
                      : line.type === "deletion"
                        ? "-"
                        : " "}
                  </span>
                  {line.content}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
