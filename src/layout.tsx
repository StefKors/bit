import { ReactNode } from "react"
import { CommitInfo } from "@/components/CommitInfo"
import styles from "./layout.module.css"

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className={styles.layout}>
      <main className={styles.main}>{children}</main>
      <CommitInfo />
    </div>
  )
}
