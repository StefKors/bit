/**
 * Pure functions for repository tree sync logic.
 * Extracted from GitHubClient for testability.
 */

import { deterministicId } from "./deterministic-id"

export interface GitHubTreeItem {
  path?: string
  type?: string
  sha?: string
  size?: number
  url?: string
}

export interface TreeEntryRecord {
  id: string
  ref: string
  path: string
  name: string
  type: "dir" | "file"
  sha: string
  size: number | undefined
  url: string | undefined
  htmlUrl: string
  repoId: string
  createdAt: number
  updatedAt: number
}

export interface ExistingEntry {
  id: string
  path: string
}

export function buildTreeEntryId(repoId: string, branch: string, path: string): string {
  return deterministicId("repoTree", repoId, branch, path)
}

export function buildTreeEntry(
  item: GitHubTreeItem,
  repoId: string,
  branch: string,
  owner: string,
  repo: string,
  now: number,
): TreeEntryRecord | null {
  if (!item.path) return null

  const pathParts = item.path.split("/")
  const name = pathParts[pathParts.length - 1]
  const entryId = buildTreeEntryId(repoId, branch, item.path)
  const type = item.type === "tree" ? "dir" : "file"
  const pathType = type === "dir" ? "tree" : "blob"

  return {
    id: entryId,
    ref: branch,
    path: item.path,
    name,
    type,
    sha: item.sha || "",
    size: item.size || undefined,
    url: item.url || undefined,
    htmlUrl: `https://github.com/${owner}/${repo}/${pathType}/${branch}/${item.path}`,
    repoId,
    createdAt: now,
    updatedAt: now,
  }
}

export function buildTreeEntries(
  items: GitHubTreeItem[],
  repoId: string,
  branch: string,
  owner: string,
  repo: string,
  now: number,
): TreeEntryRecord[] {
  const entries: TreeEntryRecord[] = []
  for (const item of items) {
    const entry = buildTreeEntry(item, repoId, branch, owner, repo, now)
    if (entry) entries.push(entry)
  }
  return entries
}

export function computeStaleEntries(
  existingEntries: ExistingEntry[],
  incomingPaths: Set<string>,
): string[] {
  return existingEntries.filter((e) => !incomingPaths.has(e.path)).map((e) => e.id)
}
