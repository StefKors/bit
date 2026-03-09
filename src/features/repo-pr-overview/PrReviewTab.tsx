import { CiDot } from "@/components/CiDot"
import type { PullRequestCard } from "./Types"
import styles from "./PrReviewTab.module.css"

type CiGroup = "running" | "passed" | "failed" | "skipped"

type CiReviewItem = {
  id: string
  label: string
  statusText: string
  group: CiGroup
  url: string | null
}

type PrReviewTabProps = {
  pr: PullRequestCard
}

const normalize = (value: string | null | undefined): string => (value ?? "").toLowerCase()

const classifyCiGroup = (
  status: string | null | undefined,
  conclusion: string | null | undefined,
): CiGroup => {
  const normalizedConclusion = normalize(conclusion)
  const normalizedStatus = normalize(status)

  if (
    normalizedStatus === "queued" ||
    normalizedStatus === "in_progress" ||
    normalizedStatus === "pending"
  ) {
    return "running"
  }

  if (normalizedConclusion === "success" || normalizedStatus === "success") {
    return "passed"
  }

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

  return "skipped"
}

const ciDotVariantByGroup = (group: CiGroup): "ready" | "blocked" | "checking" => {
  if (group === "passed") return "ready"
  if (group === "failed") return "blocked"
  return "checking"
}

const groupTitle: Record<CiGroup, string> = {
  running: "Running",
  passed: "Passed",
  failed: "Failed",
  skipped: "Skipped",
}

const buildCiReviewItems = (pr: PullRequestCard): CiReviewItem[] => {
  const checkRunItems: CiReviewItem[] = pr.checkRuns.map((check) => ({
    id: `check-run-${check.id}`,
    label: check.name,
    statusText: check.conclusion ?? check.status,
    group: classifyCiGroup(check.status, check.conclusion),
    url: check.detailsUrl ?? check.htmlUrl ?? null,
  }))

  const commitStatusItems: CiReviewItem[] = pr.commitStatuses.map((status) => ({
    id: `status-${status.id}`,
    label: status.context,
    statusText: status.description ?? status.state,
    group: classifyCiGroup(status.state, status.state),
    url: status.targetUrl,
  }))

  const workflowRunItems: CiReviewItem[] = pr.workflowRuns.map((run) => ({
    id: `workflow-run-${run.id}`,
    label:
      run.runNumber !== null
        ? `${run.name} #${run.runNumber}${run.runAttempt && run.runAttempt > 1 ? ` (attempt ${run.runAttempt})` : ""}`
        : run.name,
    statusText: run.conclusion ?? run.status,
    group: classifyCiGroup(run.status, run.conclusion),
    url: run.htmlUrl,
  }))

  const workflowJobItems: CiReviewItem[] = pr.workflowJobs.map((job) => ({
    id: `workflow-job-${job.id}`,
    label: job.name,
    statusText: job.conclusion ?? job.status,
    group: classifyCiGroup(job.status, job.conclusion),
    url: job.htmlUrl ?? job.runUrl,
  }))

  return [...checkRunItems, ...workflowRunItems, ...workflowJobItems, ...commitStatusItems]
}

export const PrReviewTab = ({ pr }: PrReviewTabProps) => {
  const items = buildCiReviewItems(pr)
  const grouped: Record<CiGroup, CiReviewItem[]> = {
    running: [],
    passed: [],
    failed: [],
    skipped: [],
  }

  for (const item of items) {
    grouped[item.group].push(item)
  }

  const runningCount = grouped.running.length

  if (items.length === 0) {
    return (
      <section className={styles.reviewTab}>
        <p className={styles.emptyState}>No checks or workflow runs yet.</p>
      </section>
    )
  }

  return (
    <section className={styles.reviewTab}>
      <header className={styles.summary}>
        <span className={styles.summaryTitle}>
          {runningCount > 0 ? `${runningCount} checks running` : "All checks finished"}
        </span>
        <span className={styles.summaryMeta}>
          {grouped.passed.length} passed, {grouped.failed.length} failed, {grouped.skipped.length}{" "}
          skipped
        </span>
      </header>

      {(["running", "failed", "passed", "skipped"] as CiGroup[]).map((group) =>
        grouped[group].length > 0 ? (
          <section key={group} className={styles.group}>
            <h3 className={styles.groupTitle}>{groupTitle[group]}</h3>
            <ul className={styles.list}>
              {grouped[group].map((item) => (
                <li key={item.id} className={styles.row}>
                  <CiDot variant={ciDotVariantByGroup(item.group)} />
                  {item.url ? (
                    <a
                      className={styles.link}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      title="Open in GitHub"
                    >
                      <span className={styles.label}>{item.label}</span>
                      <span className={styles.statusText}>{item.statusText}</span>
                    </a>
                  ) : (
                    <div className={styles.link}>
                      <span className={styles.label}>{item.label}</span>
                      <span className={styles.statusText}>{item.statusText}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </section>
  )
}
