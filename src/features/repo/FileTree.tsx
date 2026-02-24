import { useState } from "react"
import { Link } from "@tanstack/react-router"
import {
  FileIcon,
  FileDirectoryIcon,
  GitBranchIcon,
  ChevronRightIcon,
} from "@primer/octicons-react"
import styles from "./FileTree.module.css"

export interface TreeEntry {
  id: string
  path: string
  name: string
  type: "file" | "dir"
  sha: string
  size: number | null
}

interface FileTreeProps {
  entries: readonly TreeEntry[]
  owner: string
  repo: string
  branch: string
  currentPath?: string
  variant?: "default" | "sidebar"
  /** When true and entries are empty, show loading state instead of "No files synced yet" */
  isLoading?: boolean
}

// Build tree structure from flat entries
interface TreeNode {
  entry: TreeEntry
  children: TreeNode[]
}

const buildTree = (entries: readonly TreeEntry[]): TreeNode[] => {
  const rootNodes: TreeNode[] = []
  const nodeMap = new Map<string, TreeNode>()

  // Sort entries: directories first, then alphabetically
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "dir" ? -1 : 1
    }
    return a.path.localeCompare(b.path)
  })

  // First pass: create all nodes
  for (const entry of sortedEntries) {
    nodeMap.set(entry.path, { entry, children: [] })
  }

  // Second pass: build hierarchy
  for (const entry of sortedEntries) {
    const node = nodeMap.get(entry.path)!
    const pathParts = entry.path.split("/")

    if (pathParts.length === 1) {
      // Root level entry
      rootNodes.push(node)
    } else {
      // Find parent
      const parentPath = pathParts.slice(0, -1).join("/")
      const parent = nodeMap.get(parentPath)
      if (parent) {
        parent.children.push(node)
      } else {
        // Parent doesn't exist (shouldn't happen with proper tree data)
        rootNodes.push(node)
      }
    }
  }

  return rootNodes
}

// Get only root level entries (for default view)
const getRootEntries = (entries: readonly TreeEntry[]): TreeEntry[] => {
  return entries
    .filter((entry) => !entry.path.includes("/"))
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "dir" ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
}

export function FileTree({
  entries,
  owner,
  repo,
  branch,
  currentPath,
  variant = "default",
  isLoading = false,
}: FileTreeProps) {
  if (entries.length === 0) {
    return (
      <div className={`${styles.container} ${variant === "sidebar" ? styles.sidebar : ""}`}>
        <div className={styles.header}>
          <GitBranchIcon className={styles.branchIcon} size={16} />
          <span className={styles.branchName}>{branch}</span>
        </div>
        <div className={styles.emptyState}>
          {isLoading ? (
            <p className={styles.emptyText}>Loading files...</p>
          ) : (
            <>
              <FileDirectoryIcon className={styles.emptyIcon} size={32} />
              <p className={styles.emptyText}>Files sync automatically when you open this page</p>
            </>
          )}
        </div>
      </div>
    )
  }

  if (variant === "sidebar") {
    const tree = buildTree(entries)
    return (
      <div className={`${styles.container} ${styles.sidebar}`}>
        <div className={styles.header}>
          <GitBranchIcon className={styles.branchIcon} size={16} />
          <span className={styles.branchName}>{branch}</span>
        </div>
        <ul className={styles.list}>
          {tree.map((node) => (
            <TreeNodeItem
              key={node.entry.id}
              node={node}
              owner={owner}
              repo={repo}
              branch={branch}
              currentPath={currentPath}
              depth={0}
            />
          ))}
        </ul>
      </div>
    )
  }

  // Default flat view (root level only)
  const rootEntries = getRootEntries(entries)

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <GitBranchIcon className={styles.branchIcon} size={16} />
        <span className={styles.branchName}>{branch}</span>
      </div>
      <ul className={styles.list}>
        {rootEntries.map((entry) => (
          <FileTreeItem
            key={entry.id}
            entry={entry}
            owner={owner}
            repo={repo}
            branch={branch}
            isActive={currentPath === entry.path}
          />
        ))}
      </ul>
    </div>
  )
}

interface FileTreeItemProps {
  entry: TreeEntry
  owner: string
  repo: string
  branch: string
  isActive?: boolean
}

function FileTreeItem({ entry, owner, repo, branch, isActive }: FileTreeItemProps) {
  const isDir = entry.type === "dir"

  // For directories, link to tree view. For files, link to blob view.
  const to = isDir ? "/$owner/$repo/tree/$branch/$" : "/$owner/$repo/blob/$branch/$"

  return (
    <Link
      to={to}
      params={{ owner, repo, branch, _splat: entry.path }}
      className={`${styles.item} ${isActive ? styles.itemActive : ""}`}
    >
      {isDir ? (
        <FileDirectoryIcon className={`${styles.icon} ${styles.iconFolder}`} size={16} />
      ) : (
        <FileIcon className={styles.icon} size={16} />
      )}
      <span className={styles.name}>{entry.name}</span>
    </Link>
  )
}

interface TreeNodeItemProps {
  node: TreeNode
  owner: string
  repo: string
  branch: string
  currentPath?: string
  depth: number
}

function TreeNodeItem({ node, owner, repo, branch, currentPath, depth }: TreeNodeItemProps) {
  const { entry, children } = node
  const isDir = entry.type === "dir"
  const isActive = currentPath === entry.path
  const isInActivePath = currentPath?.startsWith(entry.path + "/")

  const [expanded, setExpanded] = useState(isInActivePath || depth < 1)

  const to = isDir ? "/$owner/$repo/tree/$branch/$" : "/$owner/$repo/blob/$branch/$"

  const handleClick = (e: React.MouseEvent) => {
    if (isDir) {
      e.preventDefault()
      setExpanded(!expanded)
    }
  }

  return (
    <li>
      <Link
        to={to}
        params={{ owner, repo, branch, _splat: entry.path }}
        className={`${styles.item} ${styles.sidebarItem} ${isActive ? styles.itemActive : ""}`}
        style={{ "--indent": depth } as React.CSSProperties}
        onClick={handleClick}
      >
        {isDir && (
          <button
            className={`${styles.expandButton} ${expanded ? styles.expanded : ""}`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setExpanded(!expanded)
            }}
          >
            <ChevronRightIcon size={12} />
          </button>
        )}
        {isDir ? (
          <FileDirectoryIcon className={`${styles.icon} ${styles.iconFolder}`} size={16} />
        ) : (
          <FileIcon className={styles.icon} size={16} />
        )}
        <span className={styles.name}>{entry.name}</span>
      </Link>
      {isDir && expanded && children.length > 0 && (
        <ul className={styles.list}>
          {children.map((child) => (
            <TreeNodeItem
              key={child.entry.id}
              node={child}
              owner={owner}
              repo={repo}
              branch={branch}
              currentPath={currentPath}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
