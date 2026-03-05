import { id } from "@instantdb/admin"
import { adminDb } from "@/lib/InstantAdmin"
import { log } from "@/lib/Logger"
import { extractInstallationId } from "@/lib/GithubApp"
import { syncPRActivitySafely } from "@/lib/GithubPrActivity"
import { syncPRFiles } from "@/lib/GithubPrFiles"

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
interface JsonObject {
  [key: string]: JsonValue | undefined
}

const asObject = (value: JsonValue | undefined): JsonObject | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value : null

const asString = (value: JsonValue | undefined): string | undefined =>
  typeof value === "string" ? value : undefined

const asNumber = (value: JsonValue | undefined): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined

const asBoolean = (value: JsonValue | undefined): boolean | undefined =>
  typeof value === "boolean" ? value : undefined

const asArray = (value: JsonValue | undefined): JsonValue[] => (Array.isArray(value) ? value : [])

const parseTimestamp = (value: JsonValue | undefined): number | undefined => {
  const iso = asString(value)
  if (!iso) return undefined
  const parsed = Date.parse(iso)
  return Number.isFinite(parsed) ? parsed : undefined
}

const toJson = (value: JsonValue | object): string => JSON.stringify(value)

const getRepoFullName = (payload: JsonObject): string | undefined => {
  const repository = asObject(payload.repository)
  return asString(repository?.full_name)
}

const getPullRequestNumber = (payload: JsonObject): number | undefined => {
  const rootNumber = asNumber(payload.number)
  if (rootNumber !== undefined) return rootNumber

  const pullRequest = asObject(payload.pull_request)
  const prNumber = asNumber(pullRequest?.number)
  if (prNumber !== undefined) return prNumber

  const issue = asObject(payload.issue)
  return asNumber(issue?.number)
}

const findRepoByFullName = async (
  fullName: string,
): Promise<{ id: string; fullName: string } | null> => {
  const { repos } = await adminDb.query({
    repos: {
      $: { where: { fullName }, limit: 1 },
    },
  })
  const repo = repos?.[0]
  if (!repo) return null
  return { id: repo.id, fullName: repo.fullName }
}

const upsertPullRequestFromPayload = async (
  repoId: string,
  repoFullName: string,
  payload: JsonObject,
  now: number,
): Promise<string | null> => {
  const prNumber = getPullRequestNumber(payload)
  if (prNumber === undefined) return null

  const { repos } = await adminDb.query({
    repos: {
      $: { where: { fullName: repoFullName }, limit: 1 },
      pullRequests: {
        $: { where: { number: prNumber }, limit: 1 },
      },
    },
  })
  const repo = repos?.[0]
  if (!repo) return null
  const existing = repo.pullRequests?.[0]

  const pullRequest = asObject(payload.pull_request)
  const user = asObject(pullRequest?.user)
  const base = asObject(pullRequest?.base)
  const head = asObject(pullRequest?.head)
  const mergedBy = asObject(pullRequest?.merged_by)
  const labels = asArray(pullRequest?.labels)
  const assignees = asArray(pullRequest?.assignees)
  const requestedReviewers = asArray(pullRequest?.requested_reviewers)

  const update = {
    nodeId: asString(pullRequest?.node_id),
    number: prNumber,
    title: asString(pullRequest?.title),
    body: asString(pullRequest?.body),
    state: asString(pullRequest?.state),
    draft: asBoolean(pullRequest?.draft),
    locked: asBoolean(pullRequest?.locked),
    merged: asBoolean(pullRequest?.merged),
    mergeable: asBoolean(pullRequest?.mergeable),
    mergeableState: asString(pullRequest?.mergeable_state),
    htmlUrl: asString(pullRequest?.html_url),
    authorLogin: asString(user?.login),
    authorAvatarUrl: asString(user?.avatar_url),
    mergedByLogin: asString(mergedBy?.login),
    mergedByAvatarUrl: asString(mergedBy?.avatar_url),
    baseRef: asString(base?.ref),
    baseSha: asString(base?.sha),
    headRef: asString(head?.ref),
    headSha: asString(head?.sha),
    commentsCount: asNumber(pullRequest?.comments),
    reviewCommentsCount: asNumber(pullRequest?.review_comments),
    commitsCount: asNumber(pullRequest?.commits),
    additions: asNumber(pullRequest?.additions),
    deletions: asNumber(pullRequest?.deletions),
    changedFiles: asNumber(pullRequest?.changed_files),
    labels: toJson(labels),
    assignees: toJson(assignees),
    requestedReviewers: toJson(requestedReviewers),
    githubCreatedAt: parseTimestamp(pullRequest?.created_at),
    githubUpdatedAt: parseTimestamp(pullRequest?.updated_at),
    githubClosedAt: parseTimestamp(pullRequest?.closed_at),
    githubMergedAt: parseTimestamp(pullRequest?.merged_at),
    payload: toJson(payload),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  if (existing) {
    await adminDb.transact(adminDb.tx.pullRequests[existing.id].update(update))
    return existing.id
  }

  const pullRequestId = id()
  await adminDb.transact(
    adminDb.tx.pullRequests[pullRequestId].update(update).link({ repo: repoId }),
  )
  return pullRequestId
}

const upsertPullRequestReview = async (
  pullRequestId: string,
  payload: JsonObject,
  now: number,
): Promise<void> => {
  const review = asObject(payload.review)
  const githubId = asNumber(review?.id)
  if (githubId === undefined) return

  const { pullRequestReviews } = await adminDb.query({
    pullRequestReviews: {
      $: { where: { githubId }, limit: 1 },
    },
  })
  const existing = pullRequestReviews?.[0]
  const author = asObject(review?.user)
  const update = {
    githubId,
    nodeId: asString(review?.node_id),
    state: asString(review?.state),
    body: asString(review?.body),
    authorLogin: asString(author?.login),
    authorAvatarUrl: asString(author?.avatar_url),
    submittedAt: parseTimestamp(review?.submitted_at),
    htmlUrl: asString(review?.html_url),
    payload: toJson(payload),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  if (existing) {
    await adminDb.transact(adminDb.tx.pullRequestReviews[existing.id].update(update))
    return
  }

  const reviewId = id()
  await adminDb.transact(
    adminDb.tx.pullRequestReviews[reviewId].update(update).link({ pullRequest: pullRequestId }),
  )
}

const upsertPullRequestReviewComment = async (
  pullRequestId: string,
  payload: JsonObject,
  now: number,
): Promise<void> => {
  const comment = asObject(payload.comment)
  const githubId = asNumber(comment?.id)
  if (githubId === undefined) return

  const { pullRequestReviewComments } = await adminDb.query({
    pullRequestReviewComments: {
      $: { where: { githubId }, limit: 1 },
    },
  })
  const existing = pullRequestReviewComments?.[0]
  const author = asObject(comment?.user)
  const update = {
    githubId,
    nodeId: asString(comment?.node_id),
    body: asString(comment?.body),
    path: asString(comment?.path),
    line: asNumber(comment?.line),
    side: asString(comment?.side),
    inReplyToId: asNumber(comment?.in_reply_to_id),
    authorLogin: asString(author?.login),
    authorAvatarUrl: asString(author?.avatar_url),
    htmlUrl: asString(comment?.html_url),
    payload: toJson(payload),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  if (existing) {
    await adminDb.transact(adminDb.tx.pullRequestReviewComments[existing.id].update(update))
    return
  }

  const commentId = id()
  await adminDb.transact(
    adminDb.tx.pullRequestReviewComments[commentId]
      .update(update)
      .link({ pullRequest: pullRequestId }),
  )
}

const upsertIssueComment = async (
  pullRequestId: string,
  payload: JsonObject,
  now: number,
): Promise<void> => {
  const issue = asObject(payload.issue)
  if (!asObject(issue?.pull_request)) return

  const comment = asObject(payload.comment)
  const githubId = asNumber(comment?.id)
  if (githubId === undefined) return

  const { issueComments } = await adminDb.query({
    issueComments: {
      $: { where: { githubId }, limit: 1 },
    },
  })
  const existing = issueComments?.[0]
  const author = asObject(comment?.user)
  const update = {
    githubId,
    nodeId: asString(comment?.node_id),
    body: asString(comment?.body),
    authorLogin: asString(author?.login),
    authorAvatarUrl: asString(author?.avatar_url),
    htmlUrl: asString(comment?.html_url),
    payload: toJson(payload),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  if (existing) {
    await adminDb.transact(adminDb.tx.issueComments[existing.id].update(update))
    return
  }

  const commentId = id()
  await adminDb.transact(
    adminDb.tx.issueComments[commentId].update(update).link({ pullRequest: pullRequestId }),
  )
}

const upsertReviewThread = async (
  pullRequestId: string,
  payload: JsonObject,
  now: number,
): Promise<void> => {
  const thread = asObject(payload.thread)
  const threadValue = thread?.id
  const threadId =
    typeof threadValue === "string" || typeof threadValue === "number"
      ? String(threadValue)
      : undefined
  if (!threadId) return

  const { pullRequestReviewThreads } = await adminDb.query({
    pullRequestReviewThreads: {
      $: { where: { threadId }, limit: 1 },
    },
  })
  const existing = pullRequestReviewThreads?.[0]
  const update = {
    threadId,
    resolved: asBoolean(thread?.resolved),
    payload: toJson(payload),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  if (existing) {
    await adminDb.transact(adminDb.tx.pullRequestReviewThreads[existing.id].update(update))
    return
  }

  const threadEntityId = id()
  await adminDb.transact(
    adminDb.tx.pullRequestReviewThreads[threadEntityId]
      .update(update)
      .link({ pullRequest: pullRequestId }),
  )
}

const upsertCheckRun = async (
  pullRequestId: string,
  payload: JsonObject,
  now: number,
): Promise<void> => {
  const checkRun = asObject(payload.check_run)
  const githubId = asNumber(checkRun?.id)
  if (githubId === undefined) return

  const { checkRuns } = await adminDb.query({
    checkRuns: {
      $: { where: { githubId }, limit: 1 },
    },
  })
  const existing = checkRuns?.[0]
  const update = {
    githubId,
    nodeId: asString(checkRun?.node_id),
    name: asString(checkRun?.name),
    status: asString(checkRun?.status),
    conclusion: asString(checkRun?.conclusion),
    detailsUrl: asString(checkRun?.details_url),
    htmlUrl: asString(checkRun?.html_url),
    startedAt: parseTimestamp(checkRun?.started_at),
    completedAt: parseTimestamp(checkRun?.completed_at),
    payload: toJson(payload),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  if (existing) {
    await adminDb.transact(adminDb.tx.checkRuns[existing.id].update(update))
    return
  }

  const checkRunId = id()
  await adminDb.transact(
    adminDb.tx.checkRuns[checkRunId].update(update).link({ pullRequest: pullRequestId }),
  )
}

const upsertCheckSuite = async (
  pullRequestId: string,
  payload: JsonObject,
  now: number,
): Promise<void> => {
  const checkSuite = asObject(payload.check_suite)
  const githubId = asNumber(checkSuite?.id)
  if (githubId === undefined) return

  const { checkSuites } = await adminDb.query({
    checkSuites: {
      $: { where: { githubId }, limit: 1 },
    },
  })
  const existing = checkSuites?.[0]
  const app = asObject(checkSuite?.app)
  const update = {
    githubId,
    nodeId: asString(checkSuite?.node_id),
    status: asString(checkSuite?.status),
    conclusion: asString(checkSuite?.conclusion),
    headSha: asString(checkSuite?.head_sha),
    branch: asString(checkSuite?.head_branch),
    appName: asString(app?.name),
    payload: toJson(payload),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  if (existing) {
    await adminDb.transact(adminDb.tx.checkSuites[existing.id].update(update))
    return
  }

  const checkSuiteId = id()
  await adminDb.transact(
    adminDb.tx.checkSuites[checkSuiteId].update(update).link({ pullRequest: pullRequestId }),
  )
}

const SYNC_TRIGGER_ACTIONS = new Set(["opened", "synchronize", "reopened"])

export const persistWebhookPayload = async (params: {
  event: string
  payload: object
}): Promise<void> => {
  const { event, payload } = params
  const payloadRecord = payload as JsonObject
  const now = Date.now()

  const repoFullName = getRepoFullName(payloadRecord)
  const repo = repoFullName ? await findRepoByFullName(repoFullName) : null

  if (!repo) return

  const installationId = extractInstallationId(payloadRecord)

  if (event === "push") {
    const pushKey = `${repo.fullName}:${asString(payloadRecord.ref) ?? ""}:${asString(payloadRecord.after) ?? ""}`
    const { pushEvents } = await adminDb.query({
      pushEvents: {
        $: { where: { pushKey }, limit: 1 },
      },
    })
    const existingPush = pushEvents?.[0]
    const repoPayload = asObject(payloadRecord.repository)
    const pushedAt = parseTimestamp(repoPayload?.pushed_at) ?? now

    await adminDb.transact(adminDb.tx.repos[repo.id].update({ pushedAt, updatedAt: now }))

    const pushUpdate = {
      pushKey,
      ref: asString(payloadRecord.ref),
      beforeSha: asString(payloadRecord.before),
      afterSha: asString(payloadRecord.after),
      forced: asBoolean(payloadRecord.forced),
      created: asBoolean(payloadRecord.created),
      deleted: asBoolean(payloadRecord.deleted),
      compareUrl: asString(payloadRecord.compare),
      commitsCount: asArray(payloadRecord.commits).length,
      payload: toJson(payloadRecord),
      createdAt: existingPush?.createdAt ?? now,
      updatedAt: now,
    }

    if (existingPush) {
      await adminDb.transact(adminDb.tx.pushEvents[existingPush.id].update(pushUpdate))
      return
    }

    const pushId = id()
    await adminDb.transact(adminDb.tx.pushEvents[pushId].update(pushUpdate).link({ repo: repo.id }))

    if (installationId) {
      const pushRef = asString(payloadRecord.ref)
      const branchName = pushRef?.replace("refs/heads/", "")
      if (branchName) {
        const { repos: reposWithPRs } = await adminDb.query({
          repos: {
            $: { where: { fullName: repo.fullName }, limit: 1 },
            pullRequests: {
              $: { where: { state: "open", headRef: branchName } },
            },
          },
        })
        const matchingPRs = reposWithPRs?.[0]?.pullRequests ?? []
        for (const pr of matchingPRs) {
          void syncPRActivitySafely({
            pullRequestId: pr.id,
            repoFullName: repo.fullName,
            installationId,
            prNumber: pr.number,
          })
        }
      }
    }

    triggerPushFileSync(repo.fullName, payloadRecord).catch((err) => {
      log.error("Failed to sync PR files on push", err)
    })
    return
  }

  const pullRequestId = await upsertPullRequestFromPayload(
    repo.id,
    repo.fullName,
    payloadRecord,
    now,
  )
  if (!pullRequestId) return

  if (event === "pull_request") {
    const action = asString(payloadRecord.action)
    if (action && SYNC_TRIGGER_ACTIONS.has(action) && installationId) {
      const prNumber = getPullRequestNumber(payloadRecord)
      if (prNumber !== undefined) {
        void syncPRActivitySafely({
          pullRequestId,
          repoFullName: repo.fullName,
          installationId,
          prNumber,
        })
      }
    }
    if (action === "opened" || action === "synchronize" || action === "reopened") {
      triggerPRFileSync(pullRequestId, repo.fullName, payloadRecord).catch((err) => {
        log.error("Failed to sync PR files on pull_request", err)
      })
    }
    return
  }

  if (event === "pull_request_review") {
    await upsertPullRequestReview(pullRequestId, payloadRecord, now)
    return
  }

  if (event === "pull_request_review_comment") {
    await upsertPullRequestReviewComment(pullRequestId, payloadRecord, now)
    return
  }

  if (event === "issue_comment") {
    await upsertIssueComment(pullRequestId, payloadRecord, now)
    return
  }

  if (event === "pull_request_review_thread") {
    await upsertReviewThread(pullRequestId, payloadRecord, now)
    return
  }

  if (event === "check_run") {
    await upsertCheckRun(pullRequestId, payloadRecord, now)
    return
  }

  if (event === "check_suite") {
    await upsertCheckSuite(pullRequestId, payloadRecord, now)
  }
}

const triggerPRFileSync = async (
  pullRequestId: string,
  repoFullName: string,
  payloadRecord: JsonObject,
): Promise<void> => {
  const installationId = extractInstallationId(payloadRecord)
  if (!installationId) return

  const pr = asObject(payloadRecord.pull_request)
  const base = asObject(pr?.base)
  const head = asObject(pr?.head)
  const baseSha = asString(base?.sha)
  const headSha = asString(head?.sha)
  if (!baseSha || !headSha) return

  const [owner, repo] = repoFullName.split("/")
  if (!owner || !repo) return

  await syncPRFiles(pullRequestId, installationId, owner, repo, baseSha, headSha)
}

const triggerPushFileSync = async (
  repoFullName: string,
  payloadRecord: JsonObject,
): Promise<void> => {
  const installationId = extractInstallationId(payloadRecord)
  if (!installationId) return

  const ref = asString(payloadRecord.ref)
  if (!ref?.startsWith("refs/heads/")) return
  const branch = ref.replace("refs/heads/", "")

  const afterSha = asString(payloadRecord.after)
  if (!afterSha) return

  const [owner, repo] = repoFullName.split("/")
  if (!owner || !repo) return

  const { repos } = await adminDb.query({
    repos: {
      $: { where: { fullName: repoFullName }, limit: 1 },
      pullRequests: {
        $: { where: { state: "open", headRef: branch } },
      },
    },
  })

  const matchingPRs = repos?.[0]?.pullRequests ?? []
  for (const pr of matchingPRs) {
    const baseSha = pr.baseSha
    if (!baseSha) continue

    // Keep PR headSha in sync so the UI can find files for the latest commit.
    // Push webhooks often arrive before the pull_request synchronize event,
    // so without this the PR's headSha would still point to the previous
    // commit and the file list would appear empty.
    await adminDb.transact(adminDb.tx.pullRequests[pr.id].update({ headSha: afterSha }))

    await syncPRFiles(pr.id, installationId, owner, repo, baseSha, afterSha)
  }
}

export const persistWebhookPayloadSafely = async (params: {
  event: string
  payload: object
}): Promise<void> => {
  try {
    await persistWebhookPayload(params)
  } catch (error) {
    log.error("Failed to persist webhook payload", error, {
      event: params.event,
    })
  }
}
