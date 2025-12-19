import { useState, useEffect } from "react"
import { fromAsyncCodeToHtml } from "@shikijs/markdown-it/async"
import MarkdownItAsync from "markdown-it-async"
import { codeToHtml } from "shiki"
import styles from "./Markdown.module.css"

// Initialize MarkdownIt instance with markdown-it-async
const md = MarkdownItAsync({
  html: true,
  linkify: true,
  breaks: true,
})

md.use(
  fromAsyncCodeToHtml(codeToHtml, {
    themes: {
      light: "github-light",
      dark: "github-dark",
    },
  }),
)

interface MarkdownProps {
  content: string
  className?: string
}

export function Markdown({ content, className }: MarkdownProps) {
  const [html, setHtml] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function render() {
      setLoading(true)
      try {
        const rendered = await md.renderAsync(content)
        if (!cancelled) {
          setHtml(rendered)
        }
      } catch (error) {
        console.error("Markdown render error:", error)
        if (!cancelled) {
          // Fallback to plain text with line breaks
          setHtml(
            content
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/\n/g, "<br />"),
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    render()

    return () => {
      cancelled = true
    }
  }, [content])

  if (loading) {
    return (
      <div
        className={`${styles.markdown} ${styles.loading} ${className ?? ""}`}
      >
        <div className={styles.skeleton} />
        <div className={styles.skeleton} style={{ width: "80%" }} />
        <div className={styles.skeleton} style={{ width: "60%" }} />
      </div>
    )
  }

  return (
    <div
      className={`${styles.markdown} ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
