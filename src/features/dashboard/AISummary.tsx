import { useState, useRef } from "react"
import { SparkleIcon, PaperAirplaneIcon } from "@primer/octicons-react"
import styles from "./AISummary.module.css"

interface AISummaryProps {
  aiEnabled: boolean
  aiConfigured: boolean
  aiModel: string
  contextPrompt: string
  userId: string
}

export const AISummary = ({
  aiEnabled,
  aiConfigured,
  aiModel,
  contextPrompt,
  userId,
}: AISummaryProps) => {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chatMode, setChatMode] = useState(false)
  const [chatHistory, setChatHistory] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([])
  const inputRef = useRef<HTMLInputElement>(null)

  const isAvailable = aiEnabled && aiConfigured

  const MAX_CONTEXT_CHARS = 4000
  const truncatedContext =
    contextPrompt.length > MAX_CONTEXT_CHARS
      ? contextPrompt.slice(0, MAX_CONTEXT_CHARS) + "\n[... truncated]"
      : contextPrompt

  const generateSummary = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/cerebras/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [
            {
              role: "system",
              content:
                "You are a concise engineering assistant. Summarize the user's GitHub activity into 3-5 bullet points. Focus on what was accomplished and what needs attention. Be brief and actionable. Use plain text, no markdown headers.",
            },
            { role: "user", content: truncatedContext },
          ],
        }),
      })
      const data = (await res.json()) as { content?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Failed to generate summary")
      setSummary(data.content ?? "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI request failed")
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    const message = inputRef.current?.value?.trim()
    if (!message) return
    inputRef.current!.value = ""

    const newHistory = [...chatHistory, { role: "user" as const, content: message }]
    setChatHistory(newHistory)

    try {
      const res = await fetch("/api/cerebras/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [
            {
              role: "system",
              content: `You are a concise engineering assistant helping with GitHub activity analysis. Here is context about the user's current work:\n\n${truncatedContext}\n\nAnswer questions briefly and helpfully.`,
            },
            ...newHistory,
          ],
        }),
      })
      const data = (await res.json()) as { content?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setChatHistory([...newHistory, { role: "assistant", content: data.content ?? "" }])
    } catch {
      setChatHistory([
        ...newHistory,
        { role: "assistant", content: "Sorry, I couldn't process that request." },
      ])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") void sendMessage()
  }

  if (!isAvailable) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <SparkleIcon size={14} className={styles.sparkle} />
          <span className={styles.headerTitle}>AI Insights</span>
        </div>
        <div className={styles.unconfigured}>
          <p className={styles.unconfiguredText}>
            {!aiConfigured
              ? "Set CEREBRAS_API_KEY to enable AI features."
              : "Enable AI features in Settings."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <SparkleIcon size={14} className={styles.sparkle} />
        <span className={styles.headerTitle}>AI Insights</span>
        <div className={styles.headerActions}>
          {!chatMode && (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => void generateSummary()}
              disabled={loading}
            >
              {loading ? "Thinking..." : summary ? "Refresh" : "Summarize"}
            </button>
          )}
          <button
            type="button"
            className={`${styles.actionBtn} ${chatMode ? styles.actionBtnActive : ""}`}
            onClick={() => {
              setChatMode(!chatMode)
            }}
          >
            {chatMode ? "Summary" : "Chat"}
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {!chatMode && (
        <div className={styles.summaryBody}>
          {loading && (
            <div className={styles.loading}>
              <div className={styles.loadingDot} />
              <div className={styles.loadingDot} />
              <div className={styles.loadingDot} />
            </div>
          )}
          {!loading && summary && <div className={styles.summaryText}>{summary}</div>}
          {!loading && !summary && (
            <p className={styles.placeholder}>
              Click "Summarize" to get an AI-powered overview of your recent activity.
            </p>
          )}
        </div>
      )}

      {chatMode && (
        <div className={styles.chatBody}>
          <div className={styles.chatMessages}>
            {chatHistory.length === 0 && (
              <p className={styles.placeholder}>Ask about your repos, PRs, or activity...</p>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className={msg.role === "user" ? styles.chatUser : styles.chatAssistant}>
                {msg.content}
              </div>
            ))}
          </div>
          <div className={styles.chatInput}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask about your work..."
              className={styles.input}
              onKeyDown={handleKeyDown}
            />
            <button type="button" className={styles.sendBtn} onClick={() => void sendMessage()}>
              <PaperAirplaneIcon size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
