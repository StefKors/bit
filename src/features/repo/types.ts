// Shared types for components

// Repo type matching the githubRepo schema (accepting undefined from InstantDB)
export interface Repo {
  id: string
  name: string
  fullName?: string
  owner: string
  description?: string | null | undefined
  private?: boolean | null | undefined
  language?: string | null | undefined
  stargazersCount?: number | null | undefined
  forksCount?: number | null | undefined
  githubUpdatedAt?: number | null | undefined
}

// Organization type matching the githubOrganization schema
export interface Organization {
  login: string
  avatarUrl?: string | null | undefined
}
