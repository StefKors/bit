import { useState, useEffect } from "react"
import { FileIcon, LinkExternalIcon, AlertIcon } from "@primer/octicons-react"
import { codeToHtml } from "shiki"
import { Markdown } from "@/components/Markdown"
import styles from "./FileViewer.module.css"

interface FileViewerProps {
  filename: string
  content: string | null
  size?: number | null
  htmlUrl?: string
  loading?: boolean
  error?: string | null
}

// Get language from filename for syntax highlighting
const getLanguageFromFilename = (filename: string): string => {
  const ext = filename.split(".").pop()?.toLowerCase() || ""

  const languageMap: Record<string, string> = {
    // JavaScript/TypeScript
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    mjs: "javascript",
    cjs: "javascript",
    // Web
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    sass: "sass",
    less: "less",
    // Data
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    xml: "xml",
    // Programming
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    kt: "kotlin",
    swift: "swift",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    php: "php",
    lua: "lua",
    r: "r",
    // Shell
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    fish: "fish",
    ps1: "powershell",
    // Config
    env: "bash",
    gitignore: "gitignore",
    dockerignore: "gitignore",
    dockerfile: "dockerfile",
    makefile: "makefile",
    // Docs
    md: "markdown",
    mdx: "mdx",
    rst: "rst",
    // Other
    sql: "sql",
    graphql: "graphql",
    gql: "graphql",
    vue: "vue",
    svelte: "svelte",
  }

  return languageMap[ext] || "text"
}

// Check if file is binary (image, etc.)
const isBinaryFile = (filename: string): boolean => {
  const ext = filename.split(".").pop()?.toLowerCase() || ""
  const binaryExtensions = [
    "png", "jpg", "jpeg", "gif", "webp", "ico", "svg", "bmp",
    "pdf", "zip", "tar", "gz", "rar",
    "mp3", "mp4", "wav", "avi", "mov",
    "ttf", "otf", "woff", "woff2", "eot",
    "exe", "dll", "so", "dylib",
  ]
  return binaryExtensions.includes(ext)
}

// Check if file is an image
const isImageFile = (filename: string): boolean => {
  const ext = filename.split(".").pop()?.toLowerCase() || ""
  return ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp"].includes(ext)
}

// Check if file is markdown
const isMarkdownFile = (filename: string): boolean => {
  const ext = filename.split(".").pop()?.toLowerCase() || ""
  return ["md", "mdx", "markdown"].includes(ext)
}

// Format file size
const formatSize = (bytes: number | null | undefined): string => {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileViewer({
  filename,
  content,
  size,
  htmlUrl,
  loading,
  error,
}: FileViewerProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string>("")
  const [highlighting, setHighlighting] = useState(false)

  const language = getLanguageFromFilename(filename)
  const isBinary = isBinaryFile(filename)
  const isImage = isImageFile(filename)
  const isMarkdown = isMarkdownFile(filename)

  useEffect(() => {
    if (!content || isBinary || isMarkdown) {
      setHighlightedHtml("")
      return
    }

    let cancelled = false
    setHighlighting(true)

    codeToHtml(content, {
      lang: language,
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
    })
      .then((html) => {
        if (!cancelled) {
          setHighlightedHtml(html)
        }
      })
      .catch((err) => {
        console.error("Syntax highlighting failed:", err)
        if (!cancelled) {
          setHighlightedHtml("")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHighlighting(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [content, language, isBinary, isMarkdown])

  const renderContent = () => {
    if (loading || highlighting) {
      return <div className={styles.loading}>Loading...</div>
    }

    if (error) {
      return (
        <div className={styles.error}>
          <AlertIcon size={32} />
          <p className={styles.errorText}>{error}</p>
        </div>
      )
    }

    if (content === null) {
      return <div className={styles.loading}>No content available</div>
    }

    if (isBinary && !isImage) {
      return (
        <div className={styles.binaryMessage}>
          <FileIcon className={styles.binaryIcon} size={32} />
          <p className={styles.binaryText}>Binary file not shown</p>
        </div>
      )
    }

    if (isImage && htmlUrl) {
      // For images, show raw URL
      const rawUrl = htmlUrl.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/")
      return (
        <div className={styles.imageWrapper}>
          <img src={rawUrl} alt={filename} />
        </div>
      )
    }

    if (isMarkdown) {
      return (
        <div className={styles.markdownWrapper}>
          <Markdown content={content} />
        </div>
      )
    }

    if (highlightedHtml) {
      const lines = content.split("\n")
      return (
        <div className={styles.lineNumbers}>
          <div className={styles.lineNumbersGutter}>
            {lines.map((_, i) => (
              <span key={i} className={styles.lineNumber}>
                {i + 1}
              </span>
            ))}
          </div>
          <div
            className={`${styles.codeWrapper} ${styles.lineContent}`}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </div>
      )
    }

    // Fallback to plain text
    return <pre className={styles.plainText}>{content}</pre>
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.fileInfo}>
          <FileIcon className={styles.fileIcon} size={16} />
          <span className={styles.fileName}>{filename}</span>
          {Boolean(size) && <span className={styles.fileSize}>{formatSize(size)}</span>}
        </div>
        <div className={styles.actions}>
          {htmlUrl && (
            <a
              href={htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.actionButton}
            >
              <LinkExternalIcon size={12} />
              <span style={{ marginLeft: "0.25rem" }}>View on GitHub</span>
            </a>
          )}
        </div>
      </div>
      <div className={styles.content}>{renderContent()}</div>
    </div>
  )
}
