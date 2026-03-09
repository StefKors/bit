import { ToolbarSelect } from "@/components/ToolbarSelect"
import { FilterIcon } from "@primer/octicons-react"

type PrStateFilter = "all" | "open" | "draft" | "needsReview" | "readyToMerge" | "merged"

const STATE_LABELS: Record<PrStateFilter, string> = {
  all: "All states",
  open: "Open",
  draft: "Draft",
  needsReview: "Needs review",
  readyToMerge: "Ready",
  merged: "Merged",
}

interface StateSelectProps {
  stateFilter: PrStateFilter
  onStateFilterChange: (value: PrStateFilter) => void
}

export const StateSelect = ({ stateFilter, onStateFilterChange }: StateSelectProps) => {
  const items = (Object.keys(STATE_LABELS) as PrStateFilter[]).map((value) => ({
    value,
    label: STATE_LABELS[value],
  }))

  return (
    <ToolbarSelect
      icon={<FilterIcon size={12} />}
      value={stateFilter}
      onValueChange={(v) => {
        onStateFilterChange(v as PrStateFilter)
      }}
      items={items}
      defaultValue="all"
      hideLabel
    />
  )
}
