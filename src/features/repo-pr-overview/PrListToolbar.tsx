import { Toolbar } from "@base-ui/react/toolbar"
import styles from "./PrListToolbar.module.css"

interface PrListToolbarProps {
  children: React.ReactNode
  className?: string
}

export const PrListToolbar = ({ children, className }: PrListToolbarProps) => (
  <Toolbar.Root className={`${styles.toolbar} ${className ?? ""}`}>{children}</Toolbar.Root>
)
