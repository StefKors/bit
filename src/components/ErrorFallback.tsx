import type { ErrorComponentProps } from "@tanstack/react-router"
import styles from "./ErrorFallback.module.css"

export const ErrorFallback = ({ error, reset }: ErrorComponentProps) => {
  const message = error instanceof Error ? error.message : "An unexpected error occurred"

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <svg
          className={styles.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
        <h2 className={styles.title}>Something went wrong</h2>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button className={styles.retryButton} onClick={reset}>
            Try again
          </button>
          <button className={styles.homeButton} onClick={() => window.location.assign("/")}>
            Go home
          </button>
        </div>
      </div>
    </div>
  )
}
