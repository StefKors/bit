import { SyncIcon } from "@primer/octicons-react"
import { Button } from "@/components/Button"
import styles from "./SyncHint.module.css"

interface SyncHintProps {
  message: string
  loading?: boolean
  onSync: () => void
}

export const SyncHint = ({ message, loading = false, onSync }: SyncHintProps) => (
  <div className={styles.hint}>
    <span className={styles.message}>{message}</span>
    <Button
      variant="default"
      size="small"
      leadingIcon={<SyncIcon size={14} />}
      loading={loading}
      onClick={onSync}
    >
      {loading ? "Syncing…" : "Sync now"}
    </Button>
  </div>
)
