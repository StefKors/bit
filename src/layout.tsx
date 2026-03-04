import { type ReactNode } from "react"
import { AppHeader } from "@/components/AppHeader"
import styles from "./layout.module.css"

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className={styles.layout}>
      <AppHeader />
      <main className={styles.main}>{children}</main>
    </div>
  )
}
