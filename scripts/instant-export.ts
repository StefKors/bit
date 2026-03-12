#!/usr/bin/env bun
/**
 * Export InstantDB data to a local JSON file for offline work.
 * Run before going offline (e.g. on a plane) to snapshot the current DB state.
 *
 * Usage:
 *   bun run instant:export       # export once
 *   bun run instant:update-local # refresh local snapshot with latest data
 * Output: instant-local/db.json
 */

import { writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { adminDb } from "../src/lib/instantAdmin"

const OUT_DIR = "instant-local"
const OUT_FILE = "db.json"

async function exportDb() {
  console.log("Exporting InstantDB data...")

  const data = await adminDb.query({
    repos: {
      pullRequests: {
        pullRequestViews: {},
        pullRequestReviews: {},
        pullRequestReviewComments: {},
        issueComments: {},
        pullRequestReviewThreads: {},
        checkRuns: {},
        checkSuites: {},
        commitStatuses: {},
        workflowRuns: {},
        workflowJobs: {},
        pullRequestCommits: {},
        pullRequestFiles: {},
        reactions: {},
        pullRequestEvents: {},
      },
    },
    $users: {},
    syncStates: {},
  })

  const payload = {
    exportedAt: new Date().toISOString(),
    data,
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const path = join(OUT_DIR, OUT_FILE)
  writeFileSync(path, JSON.stringify(payload, null, 2), "utf-8")

  const reposCount = data.repos?.length ?? 0
  const prsCount =
    data.repos?.reduce(
      (n: number, r: { pullRequests?: Array<object> }) => n + (r.pullRequests?.length ?? 0),
      0,
    ) ?? 0
  const usersCount = data.$users?.length ?? 0

  console.log(`Exported to ${path}`)
  console.log(`  repos: ${reposCount}, pullRequests: ${prsCount}, users: ${usersCount}`)
}

exportDb().catch((err) => {
  console.error("Export failed:", err)
  process.exit(1)
})
