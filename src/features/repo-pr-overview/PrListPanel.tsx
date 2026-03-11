import { useRef, useState } from "react"
import { useAuth } from "@/lib/hooks/UseAuth"
import { db } from "@/lib/InstantDb"
import { PrListToolbar } from "./PrListToolbar"
import { RepoSelect } from "./RepoSelect"
import { AuthorSelect } from "./AuthorSelect"
import { StateSelect } from "./StateSelect"
import { PrSelectionList } from "./PrSelectionList"
import { getPrStatusVariant } from "./Utils"
import styles from "./RepoPrOverviewPage.module.css"

type StateFilter = "all" | "open" | "draft" | "needsReview" | "readyToMerge" | "merged"

interface PrListPanelProps {
  owner: string
  repo: string
  selectedPrNumber: number | null
}

export const PrListPanel = ({ owner, repo, selectedPrNumber }: PrListPanelProps) => {
  const { user } = useAuth()
  const [authorFilter, setAuthorFilter] = useState<string | null>(null)
  const [stateFilter, setStateFilter] = useState<StateFilter>("all")
  const prevPrIdsRef = useRef<Set<string>>(new Set())
  const hasInitiallyLoadedRef = useRef(false)
  const ownerRepoRef = useRef(`${owner}/${repo}`)

  const fullName = `${owner}/${repo}`
  const effectiveAuthorFilter = authorFilter ?? (user?.login ? "me" : "all")
  const viewerUserId = user?.id ?? "__anonymous__"

  const { data } = db.useQuery({
    pullRequests: {
      $: {
        where: {
          "repo.fullName": fullName,
        },
        order: { updatedAt: "desc" },
        fields: [
          "number",
          "title",
          "state",
          "merged",
          "draft",
          "mergeableState",
          "authorLogin",
          "updatedAt",
          "activityUpdatedAt",
        ],
      },
      pullRequestViews: {
        $: {
          where: { userId: viewerUserId },
          limit: 1,
          fields: ["lastSeenAt"],
        },
      },
    },
  })

  const allPRs = (data?.pullRequests ?? []).map((pr) => {
    const activityRaw = pr.activityUpdatedAt ?? pr.updatedAt ?? 0
    const activityAt =
      typeof activityRaw === "number" ? activityRaw : Number.parseInt(activityRaw, 10) || 0
    const lastSeenRaw = pr.pullRequestViews?.[0]?.lastSeenAt ?? 0
    const lastSeenAt =
      typeof lastSeenRaw === "number" ? lastSeenRaw : Number.parseInt(lastSeenRaw, 10) || 0

    return {
      id: pr.id,
      number: pr.number,
      title: pr.title ?? "Untitled PR",
      state: pr.state ?? "open",
      merged: Boolean(pr.merged),
      draft: Boolean(pr.draft),
      mergeableState: pr.mergeableState ?? "unknown",
      authorLogin: pr.authorLogin ?? "unknown",
      isUnread: activityAt > lastSeenAt,
    }
  })

  const uniqueAuthors = [
    ...new Set(allPRs.map((pr) => pr.authorLogin).filter((login) => login !== "unknown")),
  ].toSorted((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))

  const authorFiltered =
    effectiveAuthorFilter === "all"
      ? allPRs
      : effectiveAuthorFilter === "me"
        ? allPRs.filter((pr) => pr.authorLogin === user?.login)
        : allPRs.filter((pr) => pr.authorLogin === effectiveAuthorFilter)

  const stateFilterToVariant: Record<string, string> = {
    draft: "draft",
    needsReview: "needsReview",
    readyToMerge: "open",
    merged: "merged",
  }

  const filteredPRs =
    stateFilter === "all"
      ? authorFiltered
      : stateFilter === "open"
        ? authorFiltered.filter((pr) => !pr.merged)
        : authorFiltered.filter(
            (pr) => getPrStatusVariant(pr).variant === stateFilterToVariant[stateFilter],
          )

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
    <div className={styles.column1}>
      <div className={styles.column1Scroll}>
        <PrListToolbar className={styles.column1Toolbar}>
          <div className={styles.column1ToolbarLeading}>
            <RepoSelect owner={owner} repo={repo} />
            <AuthorSelect
              authorFilter={effectiveAuthorFilter}
              userLogin={user?.login ?? null}
              uniqueAuthors={uniqueAuthors}
              onFilterChange={setAuthorFilter}
            />
          </div>
          <div className={styles.column1ToolbarTrailing}>
            <StateSelect stateFilter={stateFilter} onStateFilterChange={setStateFilter} />
          </div>
        </PrListToolbar>
        <div className={styles.column1ListScroll}>
          <PrSelectionList
            owner={owner}
            repo={repo}
            selectedPrNumber={resolvedSelectedNumber}
            prs={filteredPRs}
            newPrIds={newPrIds}
          />
        </div>
      </div>
    </div>
  )
}
