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

// Custom image renderer that adds error handling and lazy loading
const defaultImageRender =
  md.renderer.rules.image ||
  function (tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options)
  }

md.renderer.rules.image = function (tokens, idx, options, env, self) {
  const token = tokens[idx]
  const src = token.attrGet("src") || ""

  // Check if it's a GitHub user-attachments URL (these require auth)
  if (src.includes("github.com/user-attachments/")) {
    // These URLs can't be loaded cross-origin, show a placeholder link instead
    const alt = token.content || "Image"
    return `<a href="${src}" target="_blank" rel="noopener noreferrer" class="${styles.imageLink}">📎 ${alt}</a>`
  }

  // Add loading="lazy" and error handling for other images
  token.attrSet("loading", "lazy")
  token.attrSet("onerror", "this.style.display='none'")

  return defaultImageRender(tokens, idx, options, env, self)
}

/* eslint-disable @typescript-eslint/no-misused-promises -- markdown-it-async handles promises internally */
md.use(
  fromAsyncCodeToHtml(codeToHtml, {
    themes: {
      light: "github-light",
      dark: "github-dark",
    },
  }),
)
/* eslint-enable @typescript-eslint/no-misused-promises */

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

    void render()

    return () => {
      cancelled = true
    }
  }, [content])

  if (loading) {
    return (
      <div className={`${styles.markdown} ${styles.loading} ${className ?? ""}`}>
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
