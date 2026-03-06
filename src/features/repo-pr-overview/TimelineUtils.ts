import type { TimelineItem } from "./Types"

export const getTimelineItemKey = (item: TimelineItem): string => {
  if (item.type === "opened" || item.type === "merged" || item.type === "closed") {
    return `${item.type}-${item.timestamp}`
  }
  if (item.type === "pr_event") return `pe-${item.data.id}`
  if (item.type === "commit") return `c-${item.data.id}`
  if (item.type === "review") return `r-${item.data.id}`
  if (item.type === "issue_comment") return `ic-${item.data.id}`
  return `rc-${item.data.root.id}`
}
