import styles from "./DiffViewer.module.css"
import { PatchDiff } from "@pierre/diffs/react"
import { Button } from "./Button"

interface DiffViewerProps {
  filename: string
  previousFilename: string | null
  patch: string | null
  additions: number
  deletions: number
}

export function DiffViewer({
  filename,
  previousFilename,
  patch,
}: DiffViewerProps) {
  const oldFilename = previousFilename ?? filename
  const formattedPatch = `diff --git a/${oldFilename} b/${filename}
--- a/${oldFilename}
+++ b/${filename}
${patch}`

  return (
    <div className={styles.container}>
      <PatchDiff
        patch={formattedPatch}
        options={{
          theme: { dark: "pierre-dark", light: "pierre-light" },
          diffStyle: "split", // patches often look better unified
          enableHoverUtility: true,
        }}
        // ─────────────────────────────────────────────────────────────
        // LINE ANNOTATIONS
        // ─────────────────────────────────────────────────────────────

        // Array of annotations to display on specific lines.
        // Keep annotation arrays stable (useState/useMemo) to avoid re-renders.
        // Annotation metadata can be typed any way you'd like.
        // Multiple annotations can target the same side/line.
        lineAnnotations={
          [
            // {
            //   side: "additions", // or 'deletions'
            //   lineNumber: 16, // visual line number in the diff
            //   metadata: { threadId: "abc123" },
            // },
          ]
        }
        // ─────────────────────────────────────────────────────────────
        // HEADER METADATA
        // ─────────────────────────────────────────────────────────────

        // Render custom content on the right side of the file header,
        // after the +/- line metrics.
        // Props: { oldFile?, newFile?, fileDiff? }
        renderHeaderMetadata={({ fileDiff }) => (
          <span>{fileDiff?.newName}</span>
        )}
        // ─────────────────────────────────────────────────────────────
        // HOVER UTILITY
        // ─────────────────────────────────────────────────────────────

        // Render function for each annotation. Despite the diff being
        // rendered in shadow DOM, annotations use slots so you can use
        // normal CSS and styling.
        renderAnnotation={(annotation) => (
          <div>
            <span>{annotation.lineNumber}</span>
            <span>{annotation.side}</span>
          </div>
        )}
        // ─────────────────────────────────────────────────────────────
        // HOVER UTILITY
        // ─────────────────────────────────────────────────────────────

        // Render UI in the line number column on hover.
        // Requires options.enableHoverUtility = true
        //
        // Note: This is NOT reactive - render is not called on every
        // mouse move. Use getHoveredLine() in click handlers.
        renderHoverUtility={(getHoveredLine) => (
          <Button
            variant="primary"
            type="button"
            onClick={() => {
              const result = getHoveredLine()
              if (!result) return
              const { lineNumber, side } = result
              console.log(`Clicked line ${lineNumber} on ${side}`)
            }}
          >
            +
          </Button>
        )}
        // ─────────────────────────────────────────────────────────────
        // LINE SELECTION (controlled)
        // ─────────────────────────────────────────────────────────────

        // Programmatically control which lines are selected.
        // Works with both 'split' and 'unified' diff styles.
        // selectedLines={{
        //   start: 3,
        //   end: 5,
        //   side: "additions", // optional, defaults to 'additions'
        //   endSide: "additions", // optional, defaults to 'side'
        // }}
      />
    </div>
  )
}
