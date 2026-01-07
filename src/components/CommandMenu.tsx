import { useRef, useState, useImperativeHandle, forwardRef } from "react"
import { Command } from "cmdk"
import { useNavigate } from "@tanstack/react-router"
import {
  RepoIcon,
  GitPullRequestIcon,
  IssueOpenedIcon,
  SearchIcon,
  ArrowLeftIcon,
  FileCodeIcon,
  HomeIcon,
} from "@primer/octicons-react"
import { db } from "@/lib/instantDb"
import { useAuth } from "@/lib/hooks/useAuth"
import { Avatar } from "./Avatar"
import styles from "./CommandMenu.module.css"

type Page = "home" | { type: "repo"; repoId: string; fullName: string }

export type CommandMenuHandle = {
  open: () => void
  close: () => void
  toggle: () => void
}

export const CommandMenu = forwardRef<CommandMenuHandle>(function CommandMenu(_, ref) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen((prev) => !prev),
  }))
  const [search, setSearch] = useState("")
  const [pages, setPages] = useState<Page[]>(["home"])
  const activePage = pages[pages.length - 1]

  // Query data
  const { data } = db.useQuery(
    user
      ? {
          repos: {
            $: { where: { userId: user.id } },
            pullRequests: {},
            issues: {},
          },
        }
      : null,
  )

  const repos = data?.repos ?? []

  // Get currently selected repo if we're on a repo page
  const currentRepo =
    typeof activePage === "object" && activePage.type === "repo"
      ? repos.find((r) => r.id === activePage.repoId)
      : null

  const openPRs = currentRepo?.pullRequests?.filter((pr) => pr.state === "open") ?? []
  const closedPRs = currentRepo?.pullRequests?.filter((pr) => pr.state === "closed") ?? []
  const openIssues = currentRepo?.issues?.filter((i) => i.state === "open") ?? []
  const closedIssues = currentRepo?.issues?.filter((i) => i.state === "closed") ?? []

  // Keyboard shortcut to open
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      setOpen((prev) => !prev)
    }
  }

  // Register global listener (only once)
  const registered = useRef(false)
  if (!registered.current && typeof window !== "undefined") {
    registered.current = true
    window.addEventListener("keydown", handleKeyDown)
  }

  const goBack = () => {
    setPages((p) => p.slice(0, -1))
    setSearch("")
  }

  const selectRepo = (repo: (typeof repos)[0]) => {
    setPages((p) => [...p, { type: "repo", repoId: repo.id, fullName: repo.fullName }])
    setSearch("")
    // Focus input after page change
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const navigateTo = (path: string, params?: Record<string, string>) => {
    setOpen(false)
    setPages(["home"])
    setSearch("")
    // Build URL from path template and params
    let url = path
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url = url.replace(`$${key}`, value)
      }
    }
    void navigate({ to: url })
  }

  const handleCommandKeyDown = (e: React.KeyboardEvent) => {
    // Tab to select and drill down (for repos)
    if (e.key === "Tab" && activePage === "home") {
      const selected = document.querySelector('[data-selected="true"]')
      const repoId = selected?.getAttribute("data-repo-id")
      if (repoId) {
        e.preventDefault()
        const repo = repos.find((r) => r.id === repoId)
        if (repo) selectRepo(repo)
      }
    }

    // Escape/Backspace on empty to go back
    if (e.key === "Escape" || (e.key === "Backspace" && !search)) {
      if (pages.length > 1) {
        e.preventDefault()
        goBack()
      }
    }
  }

  if (!user) return null

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command Menu"
      className={styles.dialog}
      onKeyDown={handleCommandKeyDown}
    >
      <div className={styles.header}>
        {pages.length > 1 && (
          <button className={styles.backButton} onClick={goBack} type="button">
            <ArrowLeftIcon size={16} />
          </button>
        )}
        <div className={styles.inputWrapper}>
          <SearchIcon size={16} className={styles.searchIcon} />
          <Command.Input
            ref={inputRef}
            value={search}
            onValueChange={setSearch}
            placeholder={
              activePage === "home"
                ? "Search repositories, PRs, issues..."
                : `Search in ${typeof activePage === "object" ? activePage.fullName : ""}...`
            }
            className={styles.input}
          />
        </div>
        <kbd className={styles.kbd}>esc</kbd>
      </div>

      <Command.List className={styles.list}>
        <Command.Empty className={styles.empty}>No results found.</Command.Empty>

        {activePage === "home" && (
          <>
            {/* Quick Actions */}
            <Command.Group heading="Quick Actions" className={styles.group}>
              <Command.Item
                className={styles.item}
                onSelect={() => navigateTo("/")}
                keywords={["home", "dashboard", "overview"]}
              >
                <HomeIcon size={16} className={styles.itemIcon} />
                <span>Go to Dashboard</span>
              </Command.Item>
            </Command.Group>

            {/* Repositories */}
            <Command.Group heading="Repositories" className={styles.group}>
              {repos.map((repo) => {
                const prCount = repo.pullRequests?.filter((p) => p.state === "open").length ?? 0
                const issueCount = repo.issues?.filter((i) => i.state === "open").length ?? 0
                return (
                  <Command.Item
                    key={repo.id}
                    value={repo.fullName}
                    className={styles.item}
                    data-repo-id={repo.id}
                    onSelect={() =>
                      navigateTo("/$owner/$repo", {
                        owner: repo.owner,
                        repo: repo.name,
                      })
                    }
                    keywords={[repo.name, repo.owner, repo.description ?? ""]}
                  >
                    <RepoIcon size={16} className={styles.itemIcon} />
                    <div className={styles.itemContent}>
                      <span className={styles.itemTitle}>{repo.fullName}</span>
                      {repo.description && (
                        <span className={styles.itemDescription}>{repo.description}</span>
                      )}
                    </div>
                    <div className={styles.badges}>
                      {Boolean(prCount) && (
                        <span className={styles.badge}>
                          <GitPullRequestIcon size={12} /> {prCount}
                        </span>
                      )}
                      {Boolean(issueCount) && (
                        <span className={styles.badge}>
                          <IssueOpenedIcon size={12} /> {issueCount}
                        </span>
                      )}
                    </div>
                    <kbd className={styles.tabHint}>tab</kbd>
                  </Command.Item>
                )
              })}
            </Command.Group>
          </>
        )}

        {typeof activePage === "object" && activePage.type === "repo" && currentRepo && (
          <>
            {/* Repo Quick Actions */}
            <Command.Group heading="Navigate" className={styles.group}>
              <Command.Item
                className={styles.item}
                onSelect={() =>
                  navigateTo("/$owner/$repo", {
                    owner: currentRepo.owner,
                    repo: currentRepo.name,
                  })
                }
              >
                <FileCodeIcon size={16} className={styles.itemIcon} />
                <span>View Code</span>
              </Command.Item>
              <Command.Item
                className={styles.item}
                onSelect={() =>
                  navigateTo("/$owner/$repo/pulls", {
                    owner: currentRepo.owner,
                    repo: currentRepo.name,
                  })
                }
              >
                <GitPullRequestIcon size={16} className={styles.itemIcon} />
                <span>All Pull Requests</span>
                <span className={styles.count}>{currentRepo.pullRequests?.length ?? 0}</span>
              </Command.Item>
              <Command.Item
                className={styles.item}
                onSelect={() =>
                  navigateTo("/$owner/$repo/issues", {
                    owner: currentRepo.owner,
                    repo: currentRepo.name,
                  })
                }
              >
                <IssueOpenedIcon size={16} className={styles.itemIcon} />
                <span>All Issues</span>
                <span className={styles.count}>{currentRepo.issues?.length ?? 0}</span>
              </Command.Item>
            </Command.Group>

            {/* Open PRs */}
            {openPRs.length > 0 && (
              <Command.Group heading="Open Pull Requests" className={styles.group}>
                {openPRs.slice(0, 10).map((pr) => (
                  <Command.Item
                    key={pr.id}
                    value={`${pr.number} ${pr.title}`}
                    className={styles.item}
                    onSelect={() =>
                      navigateTo("/$owner/$repo/pull/$number", {
                        owner: currentRepo.owner,
                        repo: currentRepo.name,
                        number: String(pr.number),
                      })
                    }
                    keywords={[pr.title, pr.authorLogin ?? "", String(pr.number)]}
                  >
                    <GitPullRequestIcon size={16} className={styles.itemIconGreen} />
                    <div className={styles.itemContent}>
                      <span className={styles.itemTitle}>
                        <span className={styles.prNumber}>#{pr.number}</span> {pr.title}
                      </span>
                    </div>
                    {pr.authorAvatarUrl && (
                      <Avatar src={pr.authorAvatarUrl} name={pr.authorLogin} size={20} />
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Closed/Merged PRs */}
            {closedPRs.length > 0 && (
              <Command.Group heading="Closed Pull Requests" className={styles.group}>
                {closedPRs.slice(0, 5).map((pr) => (
                  <Command.Item
                    key={pr.id}
                    value={`${pr.number} ${pr.title}`}
                    className={styles.item}
                    onSelect={() =>
                      navigateTo("/$owner/$repo/pull/$number", {
                        owner: currentRepo.owner,
                        repo: currentRepo.name,
                        number: String(pr.number),
                      })
                    }
                    keywords={[pr.title, pr.authorLogin ?? "", String(pr.number)]}
                  >
                    <GitPullRequestIcon
                      size={16}
                      className={pr.merged ? styles.itemIconPurple : styles.itemIconRed}
                    />
                    <div className={styles.itemContent}>
                      <span className={styles.itemTitle}>
                        <span className={styles.prNumber}>#{pr.number}</span> {pr.title}
                      </span>
                    </div>
                    {pr.authorAvatarUrl && (
                      <Avatar src={pr.authorAvatarUrl} name={pr.authorLogin} size={20} />
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Open Issues */}
            {openIssues.length > 0 && (
              <Command.Group heading="Open Issues" className={styles.group}>
                {openIssues.slice(0, 10).map((issue) => (
                  <Command.Item
                    key={issue.id}
                    value={`${issue.number} ${issue.title}`}
                    className={styles.item}
                    onSelect={() =>
                      navigateTo("/$owner/$repo/issues/$number", {
                        owner: currentRepo.owner,
                        repo: currentRepo.name,
                        number: String(issue.number),
                      })
                    }
                    keywords={[issue.title, issue.authorLogin ?? "", String(issue.number)]}
                  >
                    <IssueOpenedIcon size={16} className={styles.itemIconGreen} />
                    <div className={styles.itemContent}>
                      <span className={styles.itemTitle}>
                        <span className={styles.prNumber}>#{issue.number}</span> {issue.title}
                      </span>
                    </div>
                    {issue.authorAvatarUrl && (
                      <Avatar src={issue.authorAvatarUrl} name={issue.authorLogin} size={20} />
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Closed Issues */}
            {closedIssues.length > 0 && (
              <Command.Group heading="Closed Issues" className={styles.group}>
                {closedIssues.slice(0, 5).map((issue) => (
                  <Command.Item
                    key={issue.id}
                    value={`${issue.number} ${issue.title}`}
                    className={styles.item}
                    onSelect={() =>
                      navigateTo("/$owner/$repo/issues/$number", {
                        owner: currentRepo.owner,
                        repo: currentRepo.name,
                        number: String(issue.number),
                      })
                    }
                    keywords={[issue.title, issue.authorLogin ?? "", String(issue.number)]}
                  >
                    <IssueOpenedIcon size={16} className={styles.itemIconMuted} />
                    <div className={styles.itemContent}>
                      <span className={styles.itemTitle}>
                        <span className={styles.prNumber}>#{issue.number}</span> {issue.title}
                      </span>
                    </div>
                    {issue.authorAvatarUrl && (
                      <Avatar src={issue.authorAvatarUrl} name={issue.authorLogin} size={20} />
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </>
        )}
      </Command.List>

      <div className={styles.footer}>
        <span className={styles.footerHint}>
          <kbd>↵</kbd> go to
        </span>
        {activePage === "home" && (
          <span className={styles.footerHint}>
            <kbd>tab</kbd> filter
          </span>
        )}
        <span className={styles.footerHint}>
          <kbd>↑↓</kbd> navigate
        </span>
        {pages.length > 1 && (
          <span className={styles.footerHint}>
            <kbd>⌫</kbd> back
          </span>
        )}
      </div>
    </Command.Dialog>
  )
})
