/**
 * Pure functions for repository commit sync logic.
 * Extracted from GitHubClient for testability.
 */

import { deterministicId } from "./deterministic-id"

export interface GitHubCommit {
  sha: string
  html_url: string
  commit: {
    message: string
    author?: { name?: string; email?: string; date?: string } | null
    committer?: { name?: string; email?: string; date?: string } | null
  }
  author?: { login?: string; avatar_url?: string } | null
  committer?: { login?: string } | null
}

export interface CommitEntryRecord {
  id: string
  sha: string
  message: string
  authorLogin: string | undefined
  authorAvatarUrl: string | undefined
  authorName: string | undefined
  authorEmail: string | undefined
  committerLogin: string | undefined
  committerName: string | undefined
  committerEmail: string | undefined
  htmlUrl: string
  ref: string
  repoId: string
  committedAt: number | undefined
  createdAt: number
  updatedAt: number
}

export interface ExistingCommit {
  id: string
  sha: string
}

export function buildCommitEntryId(repoId: string, branch: string, sha: string): string {
  return deterministicId("repoCommit", repoId, branch, sha)
}

export function buildCommitEntry(
  commit: GitHubCommit,
  repoId: string,
  branch: string,
  now: number,
): CommitEntryRecord {
  return {
    id: buildCommitEntryId(repoId, branch, commit.sha),
    sha: commit.sha,
    message: commit.commit.message,
    authorLogin: commit.author?.login || undefined,
    authorAvatarUrl: commit.author?.avatar_url || undefined,
    authorName: commit.commit.author?.name || undefined,
    authorEmail: commit.commit.author?.email || undefined,
    committerLogin: commit.committer?.login || undefined,
    committerName: commit.commit.committer?.name || undefined,
    committerEmail: commit.commit.committer?.email || undefined,
    htmlUrl: commit.html_url,
    ref: branch,
    repoId,
    committedAt: commit.commit.committer?.date
      ? new Date(commit.commit.committer.date).getTime()
      : undefined,
    createdAt: now,
    updatedAt: now,
  }
}

export function buildCommitEntries(
  commits: GitHubCommit[],
  repoId: string,
  branch: string,
  now: number,
): CommitEntryRecord[] {
  return commits.map((c) => buildCommitEntry(c, repoId, branch, now))
}

export function computeStaleCommits(
  existingCommits: ExistingCommit[],
  incomingShas: Set<string>,
): string[] {
  return existingCommits.filter((e) => !incomingShas.has(e.sha)).map((e) => e.id)
}
