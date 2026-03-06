import { Button } from "@/components/Button"
import styles from "./ErrorPage.module.css"

interface ErrorPageProps {
  title: string
  message: string
  details?: string
  onRetry?: () => void
  retryLabel?: string
  showHomeAction?: boolean
  homeHref?: string
  homeLabel?: string
}

export const ErrorPage = ({
  title,
  message,
  details,
  onRetry,
  retryLabel = "Try again",
  showHomeAction = true,
  homeHref = "/",
  homeLabel = "Go home",
}: ErrorPageProps) => (
  <section className={styles.container} role="alert" aria-live="assertive">
    <div className={styles.card}>
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
        />
      </svg>

      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.message}>{message}</p>
      </div>

      {details && (
        <details className={styles.details}>
          <summary className={styles.detailsSummary}>Technical details</summary>
          <pre className={styles.detailsBody}>{details}</pre>
        </details>
      )}

      <div className={styles.actions}>
        {onRetry && (
          <Button variant="primary" size="medium" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
        {showHomeAction && (
          <Button
            variant="default"
            size="medium"
            onClick={() => {
              window.location.assign(homeHref)
            }}
          >
            {homeLabel}
          </Button>
        )}
      </div>
    </div>
  </section>
)
