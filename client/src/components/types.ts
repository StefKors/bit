// Shared types for components

// Repo type matching the githubRepo schema
export interface Repo {
  id: string
  name: string
  fullName: string
  owner: string
  description: string | null
  private: boolean | null
  language: string | null
  stargazersCount: number | null
  forksCount: number | null
}

// Organization type matching the githubOrganization schema
export interface Organization {
  login: string
  avatarUrl: string | null
}
