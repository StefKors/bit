import { useRef, useState } from "react"
import { motion } from "motion/react"
import { useAuth } from "@/lib/hooks/UseAuth"
import { db } from "@/lib/InstantDb"
import { Tabs } from "@/components/Tabs"
import { PrAuthorFilter } from "./PrAuthorFilter"
import { PrSelectionList } from "./PrSelectionList"
import { SelectedPrHeader } from "./SelectedPrHeader"
import { PrDetailContent } from "./PrDetailContent"
import { PrFilesChanged } from "./PrFilesChanged"
import { PrCommits } from "./PrCommits"
import { PrSidebar } from "./PrSidebar"
import { mapPrToCard } from "./MapPrToCard"
import type { PullRequestCard } from "./Types"
import styles from "./RepoPrOverviewPage.module.css"

const buildPrTabs = (pr: PullRequestCard | null) => [
  {
    value: "conversation",
    label: "Conversation",
    count: pr ? pr.commentsCount + pr.reviewCommentsCount : 0,
  },
  { value: "commits", label: "Commits", count: pr?.pullRequestCommits.length ?? 0 },
  { value: "files", label: "Files Changed", count: pr?.pullRequestFiles.length ?? 0 },
]

interface RepoPrOverviewPageProps {
  owner: string
  repo: string
  selectedPrNumber: number | null
}

export function RepoPrOverviewPage({ owner, repo, selectedPrNumber }: RepoPrOverviewPageProps) {
  const { user } = useAuth()
  const [prTab, setPrTab] = useState("conversation")
  const [authorFilter, setAuthorFilter] = useState<string | null>(null)
  const [stateFilter, setStateFilter] = useState<
    "all" | "open" | "draft" | "needsReview" | "readyToMerge" | "merged"
  >("open")
  const fullName = `${owner}/${repo}`

  const effectiveAuthorFilter = authorFilter ?? (user?.login ? "me" : "all")

  const { data } = db.useQuery({
    repos: {
      $: { where: { fullName }, limit: 1 },
      pullRequests: {
        $: { order: { updatedAt: "desc" } },
        issueComments: {
          $: { order: { updatedAt: "desc" }, limit: 20 },
        },
        pullRequestReviews: {
          $: { order: { updatedAt: "desc" }, limit: 10 },
        },
        pullRequestReviewComments: {
          $: { order: { updatedAt: "desc" }, limit: 20 },
        },
        pullRequestReviewThreads: {
          $: { order: { updatedAt: "desc" }, limit: 50 },
        },
        pullRequestCommits: {
          $: { order: { updatedAt: "desc" }, limit: 50 },
        },
        checkRuns: {
          $: { order: { updatedAt: "desc" }, limit: 10 },
        },
        pullRequestEvents: {
          $: { order: { updatedAt: "desc" }, limit: 50 },
        },
        pullRequestFiles: {},
      },
    },
  })

  const repoData = data?.repos?.[0] ?? null

  const allPRs = repoData?.pullRequests.filter((pr) => pr.state === "open").map(mapPrToCard) ?? []
  const mergedPRs = repoData?.pullRequests.filter((pr) => pr.merged === true).map(mapPrToCard) ?? []

  const uniqueAuthors = [
    ...new Set(
      [...allPRs, ...mergedPRs]
        .map((pr) => pr.authorLogin)
        .filter((login): login is string => login !== "unknown"),
    ),
  ].toSorted((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))

  const authorLoginFilter =
    effectiveAuthorFilter === "me" && user?.login
      ? user.login
      : effectiveAuthorFilter !== "all" && effectiveAuthorFilter !== "me"
        ? effectiveAuthorFilter
        : null

  const filterByAuthor = (prs: PullRequestCard[]) =>
    authorLoginFilter ? prs.filter((pr) => pr.authorLogin === authorLoginFilter) : prs

  const getPrBucket = (
    pr: PullRequestCard,
  ): "draft" | "needsReview" | "readyToMerge" | "merged" => {
    if (pr.merged) return "merged"
    if (pr.draft) return "draft"
    if (pr.mergeableState === "blocked" || pr.mergeableState === "unknown") return "needsReview"
    return "readyToMerge"
  }

  const filteredPRsByAuthor = filterByAuthor([...allPRs, ...mergedPRs])
  const filteredPRs =
    stateFilter === "all"
      ? filteredPRsByAuthor
      : stateFilter === "open"
        ? filteredPRsByAuthor.filter((pr) => !pr.merged)
        : filteredPRsByAuthor.filter((pr) => getPrBucket(pr) === stateFilter)
  const prevPrIdsRef = useRef<Set<string>>(new Set())
  const hasInitiallyLoadedRef = useRef(false)
  const ownerRepoRef = useRef(fullName)
  if (ownerRepoRef.current !== fullName) {
    ownerRepoRef.current = fullName
    hasInitiallyLoadedRef.current = false
    prevPrIdsRef.current = new Set()
  }
  const currentIds = new Set(filteredPRs.map((pr) => pr.id))
  if (!hasInitiallyLoadedRef.current) {
    hasInitiallyLoadedRef.current = true
    prevPrIdsRef.current = new Set(currentIds)
  }
  const newPrIds = new Set([...currentIds].filter((id) => !prevPrIdsRef.current.has(id)))
  prevPrIdsRef.current = currentIds

  const selectedPR =
    filteredPRs.find((pr) => pr.number === selectedPrNumber) ??
    (selectedPrNumber === null ? filteredPRs[0] : null)

  if (!repoData) {
    return (
      <motion.div
        className={styles.container}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className={styles.loading}>Repository not found</div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={styles.columns}>
        <aside className={styles.column1}>
          <PrAuthorFilter
            authorFilter={effectiveAuthorFilter}
            stateFilter={stateFilter}
            userLogin={user?.login ?? null}
            uniqueAuthors={uniqueAuthors}
            onFilterChange={setAuthorFilter}
            onStateFilterChange={setStateFilter}
          />
          <PrSelectionList
            owner={owner}
            repo={repo}
            selectedPrNumber={selectedPR?.number ?? null}
            prs={filteredPRs}
            newPrIds={newPrIds}
          />
        </aside>

        {selectedPR && (
          <div className={styles.prHeader}>
            <SelectedPrHeader pr={selectedPR} fullName={fullName} />
          </div>
        )}

        {selectedPR && (
          <div className={styles.prTabs}>
            <Tabs items={buildPrTabs(selectedPR)} value={prTab} onValueChange={setPrTab} />
          </div>
        )}

        <section className={styles.column2}>
          {selectedPR ? (
            prTab === "conversation" ? (
              <PrDetailContent pr={selectedPR} owner={owner} repo={repo} />
            ) : prTab === "commits" ? (
              <PrCommits pr={selectedPR} />
            ) : (
              <PrFilesChanged pr={selectedPR} />
            )
          ) : (
            <div className={styles.placeholder}>
              {allPRs.length === 0
                ? mergedPRs.length === 0
                  ? "No PR data yet. Trigger webhooks by opening/updating a PR."
                  : "Select a PR from the left column."
                : "Select a PR from the left column."}
            </div>
          )}
        </section>

        <aside className={styles.column3}>
          {selectedPR ? (
            <PrSidebar pr={selectedPR} />
          ) : (
            <p className={styles.placeholderText}>Select a PR to view details.</p>
          )}
        </aside>
      </div>
    </motion.div>
  )
}
