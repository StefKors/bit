import { ScrollArea as ScrollAreaBase } from "@base-ui/react/scroll-area"
import styles from "./ScrollArea.module.css"

const ScrollArea = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <ScrollAreaBase.Root className={`${styles.ScrollArea} ${className}`}>
      <ScrollAreaBase.Viewport className={styles.Viewport}>
        <ScrollAreaBase.Content className={styles.Content}>{children}</ScrollAreaBase.Content>
      </ScrollAreaBase.Viewport>
      <ScrollAreaBase.Scrollbar className={styles.Scrollbar}>
        <ScrollAreaBase.Thumb className={styles.Thumb} />
      </ScrollAreaBase.Scrollbar>
    </ScrollAreaBase.Root>
  )
}

export default ScrollArea
