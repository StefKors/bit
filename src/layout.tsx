import { ReactNode, useRef } from "react"
import { AppHeader } from "@/components/AppHeader"
import { CommandMenu, type CommandMenuHandle } from "@/components/CommandMenu"
import styles from "./layout.module.css"

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const commandMenuRef = useRef<CommandMenuHandle>(null)

  const handleOpenCommandMenu = () => {
    commandMenuRef.current?.open()
  }

  return (
    <div className={styles.layout}>
      <AppHeader onOpenCommandMenu={handleOpenCommandMenu} />
      <main className={styles.main}>{children}</main>
      <CommandMenu ref={commandMenuRef} />
    </div>
  )
}
