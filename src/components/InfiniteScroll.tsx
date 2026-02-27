import { useCallback, useRef } from "react"
import styles from "./InfiniteScroll.module.css"

interface InfiniteScrollProps {
  children: React.ReactNode
  hasMore: boolean
  loading?: boolean
  onLoadMore: () => void
  rootMargin?: string
  className?: string
}

export const InfiniteScroll = ({
  children,
  hasMore,
  loading = false,
  onLoadMore,
  rootMargin = "200px",
  className,
}: InfiniteScrollProps) => {
  const onLoadMoreRef = useRef(onLoadMore)
  onLoadMoreRef.current = onLoadMore

  const hasMoreRef = useRef(hasMore)
  hasMoreRef.current = hasMore

  const loadingRef = useRef(loading)
  loadingRef.current = loading

  const observerRef = useRef<IntersectionObserver>(undefined)

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      if (!node) return
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && hasMoreRef.current && !loadingRef.current) {
            onLoadMoreRef.current()
          }
        },
        { rootMargin },
      )
      observerRef.current.observe(node)
    },
    [rootMargin],
  )

  return (
    <div className={className}>
      {children}
      {hasMore && (
        <div ref={sentinelRef} className={styles.sentinel}>
          {loading && <LoadingDots />}
        </div>
      )}
    </div>
  )
}

const LoadingDots = () => (
  <div className={styles.loader}>
    <span className={styles.dot} />
    <span className={styles.dot} />
    <span className={styles.dot} />
  </div>
)
