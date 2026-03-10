import { CheckIcon, ChevronDownIcon, SkipIcon, XIcon } from "@primer/octicons-react"
import { Collapsible } from "@base-ui/react/collapsible"
import { AnimatePresence, motion } from "motion/react"
import type { KeyboardEvent } from "react"
import { CiDot } from "@/components/CiDot"
import { CiSegmentedCircle } from "@/components/CiSegmentedCircle"
import type { PullRequestCard } from "./Types"
import styles from "./PrReviewTab.module.css"
import ScrollArea from "@/components/ScrollArea"

type CiGroup = "pending" | "inProgress" | "failed" | "skipped" | "successful"

interface CiReviewItem {
  id: string
  label: string
  statusText: string
  group: CiGroup
  url: string | null
}

interface PrReviewTabProps {
  pr: PullRequestCard
  compact?: boolean
}

const normalize = (value: string | null | undefined): string => (value ?? "").toLowerCase()

const classifyCiGroup = (
  status: string | null | undefined,
  conclusion: string | null | undefined,
): CiGroup => {
  const normalizedConclusion = normalize(conclusion)
  const normalizedStatus = normalize(status)

  if (normalizedStatus === "queued" || normalizedStatus === "pending") return "pending"
  if (normalizedStatus === "in_progress") return "inProgress"

  if (normalizedConclusion === "success" || normalizedStatus === "success") return "successful"

  if (
    normalizedConclusion === "failure" ||
    normalizedConclusion === "cancelled" ||
    normalizedConclusion === "timed_out" ||
    normalizedConclusion === "action_required" ||
    normalizedStatus === "failure" ||
    normalizedStatus === "error" ||
    normalizedStatus === "failed"
  ) {
    return "failed"
  }

  if (
    normalizedConclusion === "skipped" ||
    normalizedConclusion === "neutral" ||
    normalizedConclusion === "stale"
  ) {
    return "skipped"
  }

  return "skipped"
}

const ciDotVariantByGroup = (group: CiGroup): "ready" | "blocked" | "checking" | "skipped" => {
  if (group === "successful") return "ready"
  if (group === "failed") return "blocked"
  if (group === "skipped") return "skipped"
  return "checking"
}

const groupTitle: Record<CiGroup, string> = {
  pending: "Pending",
  inProgress: "In progress",
  failed: "Failed",
  skipped: "Skipped",
  successful: "Successful",
}

const GROUP_ORDER: CiGroup[] = ["pending", "inProgress", "failed", "skipped", "successful"]

const getItemIndicator = (group: CiGroup) => {
  if (group === "successful") {
    return <CheckIcon size={13} className={styles.iconSuccess} />
  }
  if (group === "failed") {
    return <XIcon size={13} className={styles.iconFailed} />
  }
  if (group === "skipped") {
    return <SkipIcon size={13} className={styles.iconSkipped} />
  }
  return <CiDot variant={ciDotVariantByGroup(group)} />
}

const buildCiReviewItems = (pr: PullRequestCard): CiReviewItem[] => {
  console.log(pr)
  const checkRunItems: CiReviewItem[] = pr.checkRuns.map((check) => ({
    id: `check-run-${check.id}`,
    label: `Check run · ${check.name}`,
    statusText: check.conclusion ?? check.status,
    group: classifyCiGroup(check.status, check.conclusion),
    url: check.detailsUrl ?? check.htmlUrl ?? null,
  }))

  const commitStatusItems: CiReviewItem[] = pr.commitStatuses.map((status) => ({
    id: `status-${status.id}`,
    label: `Commit status · ${status.context}`,
    statusText: status.description ?? status.state,
    group: classifyCiGroup(status.state, null),
    url: status.targetUrl,
  }))

  const workflowRunItems: CiReviewItem[] = pr.workflowRuns.map((run) => ({
    id: `workflow-run-${run.id}`,
    label:
      run.runNumber !== null
        ? `Workflow run · ${run.name} #${run.runNumber}${run.runAttempt && run.runAttempt > 1 ? ` (attempt ${run.runAttempt})` : ""}`
        : `Workflow run · ${run.name}`,
    statusText: run.conclusion ?? run.status,
    group: classifyCiGroup(run.status, run.conclusion),
    url: run.htmlUrl,
  }))

  const workflowJobItems: CiReviewItem[] = pr.workflowJobs.map((job) => ({
    id: `workflow-job-${job.id}`,
    label: `Workflow job · ${job.name}`,
    statusText: job.conclusion ?? job.status,
    group: classifyCiGroup(job.status, job.conclusion),
    url: job.htmlUrl ?? job.runUrl,
  }))

  return [
    ...checkRunItems,
    ...workflowRunItems,
    ...workflowJobItems,
    ...commitStatusItems,
  ].toSorted((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))
}

interface ReviewContentProps {
  grouped: Record<CiGroup, CiReviewItem[]>
  openExternalUrl: (url: string | null) => void
  handleRowKeyDown: (event: KeyboardEvent<HTMLLIElement>, url: string | null) => void
}

const ReviewContent = ({ grouped, openExternalUrl, handleRowKeyDown }: ReviewContentProps) => (
  <div className={styles.scrollAreaContent}>
    <AnimatePresence initial={false}>
      {GROUP_ORDER.map((group) =>
        grouped[group].length > 0 ? (
          <motion.section
            key={group}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <Collapsible.Root className={styles.group} defaultOpen>
              <Collapsible.Trigger className={styles.groupTrigger}>
                <span className={styles.groupTriggerTitle}>
                  <h3 className={styles.groupTitle}>
                    {grouped[group].length} {groupTitle[group]}
                  </h3>
                </span>
                <span className={styles.groupChevron} aria-hidden>
                  <ChevronDownIcon size={12} />
                </span>
              </Collapsible.Trigger>
              <Collapsible.Panel className={styles.groupPanel}>
                <motion.ul layout className={styles.list}>
                  <AnimatePresence initial={false}>
                    {grouped[group].map((item) => (
                      <motion.li
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        onClick={item.url ? () => openExternalUrl(item.url) : undefined}
                        onKeyDown={
                          item.url ? (event) => handleRowKeyDown(event, item.url) : undefined
                        }
                        role={item.url ? "link" : undefined}
                        tabIndex={item.url ? 0 : undefined}
                        title={item.url ? "Open in GitHub" : undefined}
                        className={`${styles.row} ${item.url ? styles.rowInteractive : ""}`}
                      >
                        <div className={styles.link}>
                          <span className={styles.indicator}>{getItemIndicator(item.group)}</span>
                          <span className={styles.label}>{item.label}</span>
                          <span className={styles.statusText}>{item.statusText}</span>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </motion.ul>
              </Collapsible.Panel>
            </Collapsible.Root>
          </motion.section>
        ) : null,
      )}
    </AnimatePresence>
  </div>
)

export const PrReviewTab = ({ pr, compact = false }: PrReviewTabProps) => {
  const items = buildCiReviewItems(pr)
  const grouped: Record<CiGroup, CiReviewItem[]> = {
    pending: [],
    inProgress: [],
    failed: [],
    skipped: [],
    successful: [],
  }

  for (const item of items) {
    grouped[item.group].push(item)
  }

  const runningCount = grouped.pending.length + grouped.inProgress.length
  const openExternalUrl = (url: string | null) => {
    if (!url) return
    window.open(url, "_blank", "noopener,noreferrer")
  }
  const handleRowKeyDown = (event: KeyboardEvent<HTMLLIElement>, url: string | null) => {
    if (!url) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      openExternalUrl(url)
    }
  }

  if (items.length === 0) {
    return (
      <section className={`${styles.reviewTab} ${compact ? styles.reviewTabCompact : ""}`}>
        <p className={styles.emptyState}>No checks or workflow runs yet.</p>
      </section>
    )
  }

  return (
    <section className={`${styles.reviewTab} ${compact ? styles.reviewTabCompact : ""}`}>
      <header className={styles.summary}>
        <span className={styles.summaryIndicator}>
          <CiSegmentedCircle
            pendingCount={grouped.pending.length}
            inProgressCount={grouped.inProgress.length}
            failedCount={grouped.failed.length}
            skippedCount={grouped.skipped.length}
            successfulCount={grouped.successful.length}
            size={15}
          />
        </span>
        <span className={styles.summaryTitle}>
          {runningCount > 0 ? `${runningCount} checks running` : "All checks finished"}
        </span>
        <span className={styles.summaryMeta}>
          {grouped.successful.length} successful, {grouped.failed.length} failed,{" "}
          {grouped.skipped.length} skipped
        </span>
      </header>

      {compact ? (
        <ScrollArea className={styles.scrollArea}>
          <ReviewContent
            grouped={grouped}
            openExternalUrl={openExternalUrl}
            handleRowKeyDown={handleRowKeyDown}
          />
        </ScrollArea>
      ) : (
        <ReviewContent
          grouped={grouped}
          openExternalUrl={openExternalUrl}
          handleRowKeyDown={handleRowKeyDown}
        />
      )}
    </section>
  )
}
