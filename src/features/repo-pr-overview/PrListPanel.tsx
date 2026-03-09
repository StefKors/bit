import { useRef, useState } from "react"
import { ScrollArea } from "@base-ui/react/scroll-area"
import { useAuth } from "@/lib/hooks/UseAuth"
import { db } from "@/lib/InstantDb"
import { PrListToolbar } from "./PrListToolbar"
import { RepoSelect } from "./RepoSelect"
import { AuthorSelect } from "./AuthorSelect"
import { StateSelect } from "./StateSelect"
import { PrSelectionList } from "./PrSelectionList"
import { mapPrToCard } from "./MapPrToCard"
import type { PullRequestCard } from "./Types"
import styles from "./RepoPrOverviewPage.module.css"

interface PrListPanelProps {
  owner: string
  repo: string
  selectedPrNumber: number | null
}

export const PrListPanel = ({ owner, repo, selectedPrNumber }: PrListPanelProps) => {
  const { user } = useAuth()
  const [authorFilter, setAuthorFilter] = useState<string | null>(null)
  const [stateFilter, setStateFilter] = useState<
    "all" | "open" | "draft" | "needsReview" | "readyToMerge" | "merged"
  >("all")
  const fullName = `${owner}/${repo}`

  const effectiveAuthorFilter = authorFilter ?? (user?.login ? "me" : "all")

  const { data } = db.useQuery({
    repos: {
      $: { where: { fullName }, limit: 1 },
      pullRequests: {
        $: { order: { updatedAt: "desc" } },
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

  const resolvedSelectedNumber =
    selectedPrNumber ?? (filteredPRs.length > 0 ? filteredPRs[0].number : null)

  return (
    <ScrollArea.Root className={styles.column1}>
      <ScrollArea.Viewport className={styles.column1Viewport}>
        <ScrollArea.Content className={styles.column1Content}>
          <div className={styles.column1ContentInner}>
            <PrListToolbar>
              <RepoSelect owner={owner} repo={repo} />
              <AuthorSelect
                authorFilter={effectiveAuthorFilter}
                userLogin={user?.login ?? null}
                uniqueAuthors={uniqueAuthors}
                onFilterChange={setAuthorFilter}
              />
              <StateSelect stateFilter={stateFilter} onStateFilterChange={setStateFilter} />
            </PrListToolbar>
            <PrSelectionList
              owner={owner}
              repo={repo}
              selectedPrNumber={resolvedSelectedNumber}
              prs={filteredPRs}
              newPrIds={newPrIds}
            />
          </div>
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar className={styles.column1Scrollbar}>
        <ScrollArea.Thumb className={styles.column1Thumb} />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  )
}
