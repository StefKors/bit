export const formatRelativeTime = (dateValue: string | number | null): string => {
  if (!dateValue) return "unknown time"
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return "unknown time"
  const diffMs = Date.now() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diffMs < hour) {
    const minutes = Math.max(1, Math.floor(diffMs / minute))
    return `${minutes}m ago`
  }
  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour)
    return `${hours}h ago`
  }
  const days = Math.floor(diffMs / day)
  return `${days}d ago`
}

export const formatActivityDate = (dateValue: string | number | null): string => {
  if (!dateValue) return "Unknown time"
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return "Unknown time"
  return date.toLocaleString()
}
