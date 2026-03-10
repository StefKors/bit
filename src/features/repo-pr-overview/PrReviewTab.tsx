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

const GROUP_ORDER: CiGroup[] = ["failed", "pending", "inProgress", "skipped", "successful"]
const GROUP_SORT_PRIORITY: Record<CiGroup, number> = {
  failed: 0,
  pending: 1,
  inProgress: 2,
  skipped: 3,
  successful: 4,
}

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

const toTimestamp = (value: string | number | null | undefined): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

const getWorkflowRunIdFromUrl = (value: string | null | undefined): number | null => {
  if (!value) return null
  const match = value.match(/\/actions\/runs\/(\d+)(?:\/|$)/)
  if (!match) return null
  const parsed = Number.parseInt(match[1], 10)
  return Number.isFinite(parsed) ? parsed : null
}

const withWorkflowPrefix = (runName: string | null | undefined, checkName: string): string => {
  if (!runName) return checkName
  const normalizedRunName = normalize(runName)
  const normalizedCheckName = normalize(checkName)
  if (!normalizedRunName || normalizedCheckName.startsWith(`${normalizedRunName} /`)) {
    return checkName
  }
  return `${runName} / ${checkName}`
}

const withPrQueryParam = (url: string, prNumber: number): string => {
  try {
    const parsed = new URL(url, window.location.origin)
    parsed.searchParams.set("pr", String(prNumber))
    return parsed.toString()
  } catch {
    const separator = url.includes("?") ? "&" : "?"
    return `${url}${separator}pr=${prNumber}`
  }
}

interface CiReviewCandidate {
  dedupeKey: string
  sourcePriority: number
  item: CiReviewItem
  updatedAt: number
}

interface WorkflowRunLookup {
  name: string
  headSha: string | null
}

const buildCiReviewItems = (pr: PullRequestCard): CiReviewItem[] => {
  const candidates = new Map<string, CiReviewCandidate>()
  const workflowRunById = new Map<number, WorkflowRunLookup>()
  const currentHeadSha = normalize(pr.headSha)
  const isCurrentHead = (sha: string | null | undefined): boolean => {
    const normalizedSha = normalize(sha)
    if (!currentHeadSha || !normalizedSha) return true
    return normalizedSha === currentHeadSha
  }

  for (const run of pr.workflowRuns) {
    if (!run.githubId || !run.name) continue
    workflowRunById.set(run.githubId, { name: run.name, headSha: run.headSha })
  }

  const addCandidate = (candidate: CiReviewCandidate) => {
    const existing = candidates.get(candidate.dedupeKey)
    if (!existing) {
      candidates.set(candidate.dedupeKey, candidate)
      return
    }

    if (candidate.updatedAt > existing.updatedAt) {
      candidates.set(candidate.dedupeKey, candidate)
      return
    }

    if (
      candidate.updatedAt === existing.updatedAt &&
      candidate.sourcePriority > existing.sourcePriority
    ) {
      candidates.set(candidate.dedupeKey, candidate)
    }
  }

  const hasWorkflowJobs = pr.workflowJobs.length > 0

  // Keep the checks list close to GitHub:
  // - prefer check runs as canonical rows
  // - include workflow jobs to fill gaps where check runs are missing
  for (const check of pr.checkRuns) {
    const checkRunId =
      getWorkflowRunIdFromUrl(check.detailsUrl) ?? getWorkflowRunIdFromUrl(check.htmlUrl)
    const workflowRun = checkRunId ? workflowRunById.get(checkRunId) : undefined
    if (!isCurrentHead(check.headSha)) {
      if (!isCurrentHead(workflowRun?.headSha)) continue
    }
    const workflowRunName = workflowRun?.name
    const displayLabel = withWorkflowPrefix(workflowRunName, check.name)

    addCandidate({
      dedupeKey: `ci:${normalize(displayLabel)}`,
      sourcePriority: 3,
      updatedAt: toTimestamp(check.updatedAt),
      item: {
        id: `check-run-${check.id}`,
        label: displayLabel,
        statusText: check.conclusion ?? check.status,
        group: classifyCiGroup(check.status, check.conclusion),
        url: check.detailsUrl ?? check.htmlUrl ?? null,
      },
    })
  }

  for (const job of pr.workflowJobs) {
    const workflowRunIdFromUrl =
      getWorkflowRunIdFromUrl(job.runUrl) ?? getWorkflowRunIdFromUrl(job.htmlUrl)
    const workflowRun =
      (job.runId ? workflowRunById.get(job.runId) : undefined) ??
      (workflowRunIdFromUrl ? workflowRunById.get(workflowRunIdFromUrl) : undefined)
    if (!isCurrentHead(job.headSha) || !isCurrentHead(workflowRun?.headSha)) continue
    const workflowRunName = workflowRun?.name
    const displayLabel = withWorkflowPrefix(workflowRunName, job.name)

    addCandidate({
      dedupeKey: `ci:${normalize(displayLabel)}`,
      sourcePriority: 2,
      updatedAt: toTimestamp(job.updatedAt),
      item: {
        id: `workflow-job-${job.id}`,
        label: displayLabel,
        statusText: job.conclusion ?? job.status,
        group: classifyCiGroup(job.status, job.conclusion),
        url: job.htmlUrl ?? job.runUrl,
      },
    })
  }

  if (pr.checkRuns.length === 0 && !hasWorkflowJobs) {
    for (const run of pr.workflowRuns) {
      if (!isCurrentHead(run.headSha)) continue
      addCandidate({
        dedupeKey: `ci:${normalize(run.name)}`,
        sourcePriority: 1,
        updatedAt: toTimestamp(run.updatedAt),
        item: {
          id: `workflow-run-${run.id}`,
          label: run.name,
          statusText: run.conclusion ?? run.status,
          group: classifyCiGroup(run.status, run.conclusion),
          url: run.htmlUrl,
        },
      })
    }
  }

  for (const status of pr.commitStatuses) {
    if (!isCurrentHead(status.sha)) continue
    addCandidate({
      dedupeKey: `commit-status:${normalize(status.context)}`,
      sourcePriority: 3,
      updatedAt: toTimestamp(status.updatedAt),
      item: {
        id: `status-${status.id}`,
        label: status.context,
        statusText: status.description ?? status.state,
        group: classifyCiGroup(status.state, null),
        url: status.targetUrl,
      },
    })
  }

  return Array.from(candidates.values())
    .toSorted((a, b) => {
      const groupDiff = GROUP_SORT_PRIORITY[a.item.group] - GROUP_SORT_PRIORITY[b.item.group]
      if (groupDiff !== 0) return groupDiff

      const updatedDiff = b.updatedAt - a.updatedAt
      if (updatedDiff !== 0) return updatedDiff

      return a.item.label.localeCompare(b.item.label, undefined, { sensitivity: "base" })
    })
    .map((candidate) => candidate.item)
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
                        onClick={
                          item.url
                            ? () => {
                                openExternalUrl(item.url)
                              }
                            : undefined
                        }
                        onKeyDown={
                          item.url
                            ? (event) => {
                                handleRowKeyDown(event, item.url)
                              }
                            : undefined
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
    const urlWithPrNumber = withPrQueryParam(url, pr.number)
    window.open(urlWithPrNumber, "_blank", "noopener,noreferrer")
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
