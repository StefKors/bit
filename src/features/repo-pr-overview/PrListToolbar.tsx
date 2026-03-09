import { Toolbar } from "@base-ui/react/toolbar"
import styles from "./PrListToolbar.module.css"

interface PrListToolbarProps {
  children: React.ReactNode
}

export const PrListToolbar = ({ children }: PrListToolbarProps) => (
  <Toolbar.Root className={styles.toolbar}>{children}</Toolbar.Root>
)
