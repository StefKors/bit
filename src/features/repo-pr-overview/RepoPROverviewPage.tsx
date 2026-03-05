import { useRef, useState } from "react"
import { useParams, useSearch } from "@tanstack/react-router"
import { motion } from "motion/react"
import { useAuth } from "@/lib/hooks/useAuth"
import { db } from "@/lib/instantDb"
import { Tabs } from "@/components/Tabs"
import { PRAuthorFilter } from "./PRAuthorFilter"
import { PRSelectionList } from "./PRSelectionList"
import { SelectedPRHeader } from "./SelectedPRHeader"
import { PRDetailContent } from "./PRDetailContent"
import { PRFilesChanged } from "./PRFilesChanged"
import { PRSidebar } from "./PRSidebar"
import { mapPrToCard } from "./mapPrToCard"
import type { PullRequestCard } from "./types"
import styles from "./RepoPROverviewPage.module.css"

const PR_TABS = [
  { value: "conversation", label: "Conversation" },
  { value: "files", label: "Files Changed" },
]

export function RepoPROverviewPage() {
  const { owner, repo } = useParams({ from: "/$owner/$repo/" })
  const { selectedPrNumber } = useSearch({ from: "/$owner/$repo/" })
  const { user } = useAuth()
  const [prTab, setPrTab] = useState("conversation")
  const [authorFilter, setAuthorFilter] = useState<string | null>(null)
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
        pullRequestCommits: {
          $: { order: { updatedAt: "desc" }, limit: 50 },
        },
        checkRuns: {
          $: { order: { updatedAt: "desc" }, limit: 10 },
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
  ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))

  const authorLoginFilter =
    effectiveAuthorFilter === "me" && user?.login
      ? user.login
      : effectiveAuthorFilter !== "all" && effectiveAuthorFilter !== "me"
        ? effectiveAuthorFilter
        : null

  const filterByAuthor = (prs: PullRequestCard[]) =>
    authorLoginFilter ? prs.filter((pr) => pr.authorLogin === authorLoginFilter) : prs

  const draftPRs = filterByAuthor(allPRs.filter((pr) => pr.draft))
  const needsReviewPRs = filterByAuthor(
    allPRs.filter(
      (pr) => !pr.draft && (pr.mergeableState === "blocked" || pr.mergeableState === "unknown"),
    ),
  )
  const readyToMergePRs = filterByAuthor(
    allPRs.filter(
      (pr) => !pr.draft && pr.mergeableState !== "blocked" && pr.mergeableState !== "unknown",
    ),
  )
  const filteredMergedPRs = filterByAuthor(mergedPRs)
  const parsedSelectedPrNumber = selectedPrNumber ? Number(selectedPrNumber) : NaN
  const normalizedSelectedPrNumber = Number.isNaN(parsedSelectedPrNumber)
    ? null
    : parsedSelectedPrNumber
  const allFilteredPRs = [...draftPRs, ...needsReviewPRs, ...readyToMergePRs, ...filteredMergedPRs]
  const prevPrIdsRef = useRef<Set<string>>(new Set())
  const hasInitiallyLoadedRef = useRef(false)
  const ownerRepoRef = useRef(fullName)
  if (ownerRepoRef.current !== fullName) {
    ownerRepoRef.current = fullName
    hasInitiallyLoadedRef.current = false
    prevPrIdsRef.current = new Set()
  }
  const currentIds = new Set(allFilteredPRs.map((pr) => pr.id))
  if (!hasInitiallyLoadedRef.current) {
    hasInitiallyLoadedRef.current = true
    prevPrIdsRef.current = new Set(currentIds)
  }
  const newPrIds = new Set([...currentIds].filter((id) => !prevPrIdsRef.current.has(id)))
  prevPrIdsRef.current = currentIds

  const selectedPR =
    allFilteredPRs.find((pr) => pr.number === normalizedSelectedPrNumber) ??
    (normalizedSelectedPrNumber === null
      ? (draftPRs[0] ?? needsReviewPRs[0] ?? readyToMergePRs[0] ?? filteredMergedPRs[0])
      : null) ??
    null

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
          <PRAuthorFilter
            authorFilter={effectiveAuthorFilter}
            userLogin={user?.login ?? null}
            uniqueAuthors={uniqueAuthors}
            onFilterChange={setAuthorFilter}
          />
          <PRSelectionList
            owner={owner}
            repo={repo}
            selectedPrNumber={selectedPR?.number ?? null}
            draftPRs={draftPRs}
            needsReviewPRs={needsReviewPRs}
            readyToMergePRs={readyToMergePRs}
            mergedPRs={filteredMergedPRs}
            newPrIds={newPrIds}
          />
        </aside>

        {selectedPR && (
          <div className={styles.prHeader}>
            <SelectedPRHeader pr={selectedPR} />
          </div>
        )}

        {selectedPR && (
          <div className={styles.prTabs}>
            <Tabs items={PR_TABS} value={prTab} onValueChange={setPrTab} />
          </div>
        )}

        <section className={styles.column2}>
          {selectedPR ? (
            prTab === "conversation" ? (
              <PRDetailContent pr={selectedPR} />
            ) : (
              <PRFilesChanged pr={selectedPR} owner={owner} repo={repo} />
            )
          ) : (
            <div className={styles.placeholder}>
              {allPRs.length === 0
                ? "No PR data yet. Trigger webhooks by opening/updating a PR."
                : "Select a PR from the left column."}
            </div>
          )}
        </section>

        <aside className={styles.column3}>
          {selectedPR ? (
            <PRSidebar pr={selectedPR} />
          ) : (
            <p className={styles.placeholderText}>Select a PR to view details.</p>
          )}
        </aside>
      </div>
    </motion.div>
  )
}
