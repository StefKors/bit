/// <reference types="vite/client" />

interface CommitInfo {
  shortSha: string
  fullSha: string
  title: string
  author: string
  date: string
}

declare const __COMMIT_INFO__: CommitInfo
