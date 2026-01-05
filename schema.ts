import { pgTable, text, timestamp, boolean, index, integer, bigint } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

// =============================================================================
// Drizzle Schema
// Used by: Better Auth, drizzle-kit, drizzle-zero
// Generate Zero schema: bun run generate-zero-schema
// =============================================================================

export const authUser = pgTable("auth_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const authSession = pgTable(
  "auth_session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
  },
  (table) => [index("auth_session_userId_idx").on(table.userId)],
)

export const authAccount = pgTable(
  "auth_account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("auth_account_userId_idx").on(table.userId)],
)

export const authVerification = pgTable(
  "auth_verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("auth_verification_identifier_idx").on(table.identifier)],
)

// =============================================================================
// App Tables (synced via Zero)
// =============================================================================

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  partner: boolean("partner").notNull(),
})

// =============================================================================
// GitHub Tables (synced via Zero)
// =============================================================================

// GitHub Organizations
export const githubOrganization = pgTable(
  "github_organization",
  {
    id: text("id").primaryKey(), // GitHub node_id
    githubId: bigint("github_id", { mode: "number" }).notNull().unique(),
    login: text("login").notNull(),
    name: text("name"),
    description: text("description"),
    avatarUrl: text("avatar_url"),
    url: text("url"),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    syncedAt: timestamp("synced_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("github_org_userId_idx").on(table.userId),
    index("github_org_login_idx").on(table.login),
  ],
)

// GitHub Repositories
export const githubRepo = pgTable(
  "github_repo",
  {
    id: text("id").primaryKey(), // GitHub node_id
    githubId: bigint("github_id", { mode: "number" }).notNull().unique(),
    name: text("name").notNull(),
    fullName: text("full_name").notNull(), // owner/repo
    owner: text("owner").notNull(),
    description: text("description"),
    url: text("url"),
    htmlUrl: text("html_url"),
    private: boolean("private").default(false).notNull(),
    fork: boolean("fork").default(false).notNull(),
    defaultBranch: text("default_branch").default("main"),
    language: text("language"),
    stargazersCount: integer("stargazers_count").default(0),
    forksCount: integer("forks_count").default(0),
    openIssuesCount: integer("open_issues_count").default(0),
    organizationId: text("organization_id").references(() => githubOrganization.id, {
      onDelete: "set null",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    // GitHub timestamps
    githubCreatedAt: timestamp("github_created_at"),
    githubUpdatedAt: timestamp("github_updated_at"),
    githubPushedAt: timestamp("github_pushed_at"),
    // Internal timestamps
    syncedAt: timestamp("synced_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("github_repo_userId_idx").on(table.userId),
    index("github_repo_fullName_idx").on(table.fullName),
    index("github_repo_owner_idx").on(table.owner),
  ],
)

// GitHub Pull Requests
export const githubPullRequest = pgTable(
  "github_pull_request",
  {
    id: text("id").primaryKey(), // GitHub node_id
    githubId: bigint("github_id", { mode: "number" }).notNull(),
    number: integer("number").notNull(),
    repoId: text("repo_id")
      .notNull()
      .references(() => githubRepo.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body"),
    state: text("state").notNull(), // open, closed
    draft: boolean("draft").default(false).notNull(),
    merged: boolean("merged").default(false).notNull(),
    mergeable: boolean("mergeable"),
    mergeableState: text("mergeable_state"),
    // Author info
    authorLogin: text("author_login"),
    authorAvatarUrl: text("author_avatar_url"),
    // Branch info
    headRef: text("head_ref"),
    headSha: text("head_sha"),
    baseRef: text("base_ref"),
    baseSha: text("base_sha"),
    // URLs
    htmlUrl: text("html_url"),
    diffUrl: text("diff_url"),
    // Stats
    additions: integer("additions").default(0),
    deletions: integer("deletions").default(0),
    changedFiles: integer("changed_files").default(0),
    commits: integer("commits").default(0),
    comments: integer("comments").default(0),
    reviewComments: integer("review_comments").default(0),
    // Labels (stored as JSON string)
    labels: text("labels"),
    // Dashboard tracking: JSON array of user logins who requested review
    reviewRequestedBy: text("review_requested_by"),
    // Timestamps
    githubCreatedAt: timestamp("github_created_at"),
    githubUpdatedAt: timestamp("github_updated_at"),
    closedAt: timestamp("closed_at"),
    mergedAt: timestamp("merged_at"),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    syncedAt: timestamp("synced_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("github_pr_repoId_idx").on(table.repoId),
    index("github_pr_userId_idx").on(table.userId),
    index("github_pr_state_idx").on(table.state),
    index("github_pr_number_idx").on(table.repoId, table.number),
  ],
)

// GitHub PR Reviews
export const githubPrReview = pgTable(
  "github_pr_review",
  {
    id: text("id").primaryKey(), // GitHub node_id
    githubId: bigint("github_id", { mode: "number" }).notNull(),
    pullRequestId: text("pull_request_id")
      .notNull()
      .references(() => githubPullRequest.id, { onDelete: "cascade" }),
    state: text("state").notNull(), // APPROVED, CHANGES_REQUESTED, COMMENTED, DISMISSED, PENDING
    body: text("body"),
    authorLogin: text("author_login"),
    authorAvatarUrl: text("author_avatar_url"),
    htmlUrl: text("html_url"),
    submittedAt: timestamp("submitted_at"),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("github_review_prId_idx").on(table.pullRequestId),
    index("github_review_userId_idx").on(table.userId),
  ],
)

// GitHub PR Comments (both issue comments and review comments)
export const githubPrComment = pgTable(
  "github_pr_comment",
  {
    id: text("id").primaryKey(), // GitHub node_id
    githubId: bigint("github_id", { mode: "number" }).notNull(),
    pullRequestId: text("pull_request_id")
      .notNull()
      .references(() => githubPullRequest.id, { onDelete: "cascade" }),
    reviewId: text("review_id").references(() => githubPrReview.id, { onDelete: "cascade" }),
    commentType: text("comment_type").notNull(), // issue_comment, review_comment
    body: text("body"),
    authorLogin: text("author_login"),
    authorAvatarUrl: text("author_avatar_url"),
    htmlUrl: text("html_url"),
    // For review comments (inline comments on diff)
    path: text("path"),
    line: integer("line"),
    side: text("side"), // LEFT, RIGHT
    diffHunk: text("diff_hunk"),
    // Timestamps
    githubCreatedAt: timestamp("github_created_at"),
    githubUpdatedAt: timestamp("github_updated_at"),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("github_comment_prId_idx").on(table.pullRequestId),
    index("github_comment_reviewId_idx").on(table.reviewId),
    index("github_comment_userId_idx").on(table.userId),
  ],
)

// GitHub PR Commits (commits in a PR)
export const githubPrCommit = pgTable(
  "github_pr_commit",
  {
    id: text("id").primaryKey(), // composite: pr_id + sha
    pullRequestId: text("pull_request_id")
      .notNull()
      .references(() => githubPullRequest.id, { onDelete: "cascade" }),
    sha: text("sha").notNull(),
    message: text("message").notNull(),
    authorLogin: text("author_login"),
    authorAvatarUrl: text("author_avatar_url"),
    authorName: text("author_name"),
    authorEmail: text("author_email"),
    committerLogin: text("committer_login"),
    committerAvatarUrl: text("committer_avatar_url"),
    committerName: text("committer_name"),
    committerEmail: text("committer_email"),
    htmlUrl: text("html_url"),
    // Timestamps
    committedAt: timestamp("committed_at"),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("github_commit_prId_idx").on(table.pullRequestId),
    index("github_commit_userId_idx").on(table.userId),
  ],
)

// GitHub PR Files (changed files in a PR)
export const githubPrFile = pgTable(
  "github_pr_file",
  {
    id: text("id").primaryKey(), // composite: pr_id + sha + filename
    pullRequestId: text("pull_request_id")
      .notNull()
      .references(() => githubPullRequest.id, { onDelete: "cascade" }),
    sha: text("sha").notNull(),
    filename: text("filename").notNull(),
    status: text("status").notNull(), // added, removed, modified, renamed, copied, changed
    additions: integer("additions").default(0),
    deletions: integer("deletions").default(0),
    changes: integer("changes").default(0),
    patch: text("patch"), // The diff patch
    previousFilename: text("previous_filename"), // For renamed files
    blobUrl: text("blob_url"),
    rawUrl: text("raw_url"),
    contentsUrl: text("contents_url"),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("github_file_prId_idx").on(table.pullRequestId),
    index("github_file_userId_idx").on(table.userId),
  ],
)

// GitHub PR Events (timeline events for pull requests)
export const githubPrEvent = pgTable(
  "github_pr_event",
  {
    id: text("id").primaryKey(), // GitHub node_id or composite key
    githubId: bigint("github_id", { mode: "number" }),
    pullRequestId: text("pull_request_id")
      .notNull()
      .references(() => githubPullRequest.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(), // committed, labeled, unlabeled, assigned, unassigned, review_requested, review_request_removed, merged, closed, reopened, head_ref_force_pushed, etc.
    // Actor info
    actorLogin: text("actor_login"),
    actorAvatarUrl: text("actor_avatar_url"),
    // Event-specific data (stored as JSON)
    eventData: text("event_data"), // JSON string with event-specific fields
    // Common fields for specific event types
    commitSha: text("commit_sha"),
    commitMessage: text("commit_message"),
    labelName: text("label_name"),
    labelColor: text("label_color"),
    assigneeLogin: text("assignee_login"),
    assigneeAvatarUrl: text("assignee_avatar_url"),
    requestedReviewerLogin: text("requested_reviewer_login"),
    requestedReviewerAvatarUrl: text("requested_reviewer_avatar_url"),
    // Timestamps
    eventCreatedAt: timestamp("event_created_at"),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("github_pr_event_prId_idx").on(table.pullRequestId),
    index("github_pr_event_userId_idx").on(table.userId),
    index("github_pr_event_type_idx").on(table.eventType),
  ],
)

// GitHub Sync State (track sync status and rate limits per user)
export const githubSyncState = pgTable(
  "github_sync_state",
  {
    id: text("id").primaryKey(), // user_id + resource_type
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(), // overview, repo:{fullName}, pr:{repoId}:{number}
    resourceId: text("resource_id"), // Optional specific resource ID
    lastSyncedAt: timestamp("last_synced_at"),
    lastEtag: text("last_etag"), // For conditional requests
    // Rate limit info
    rateLimitRemaining: integer("rate_limit_remaining"),
    rateLimitReset: timestamp("rate_limit_reset"),
    // Sync status
    syncStatus: text("sync_status").default("idle"), // idle, syncing, error
    syncError: text("sync_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("github_sync_userId_idx").on(table.userId),
    index("github_sync_resource_idx").on(table.userId, table.resourceType),
  ],
)

// =============================================================================
// Relationships (used by Zero for relational queries)
// =============================================================================

// Organization relationships
export const githubOrganizationRelations = relations(githubOrganization, ({ many }) => ({
  githubRepo: many(githubRepo),
}))

// Repo relationships
export const githubRepoRelations = relations(githubRepo, ({ one, many }) => ({
  githubOrganization: one(githubOrganization, {
    fields: [githubRepo.organizationId],
    references: [githubOrganization.id],
  }),
  githubPullRequest: many(githubPullRequest),
}))

// Pull Request relationships - key for PR detail page
export const githubPullRequestRelations = relations(githubPullRequest, ({ one, many }) => ({
  githubRepo: one(githubRepo, {
    fields: [githubPullRequest.repoId],
    references: [githubRepo.id],
  }),
  githubPrFile: many(githubPrFile),
  githubPrReview: many(githubPrReview),
  githubPrComment: many(githubPrComment),
  githubPrCommit: many(githubPrCommit),
}))

// PR Review relationships
export const githubPrReviewRelations = relations(githubPrReview, ({ one, many }) => ({
  githubPullRequest: one(githubPullRequest, {
    fields: [githubPrReview.pullRequestId],
    references: [githubPullRequest.id],
  }),
  githubPrComment: many(githubPrComment),
}))

// PR Comment relationships
export const githubPrCommentRelations = relations(githubPrComment, ({ one }) => ({
  githubPullRequest: one(githubPullRequest, {
    fields: [githubPrComment.pullRequestId],
    references: [githubPullRequest.id],
  }),
  githubPrReview: one(githubPrReview, {
    fields: [githubPrComment.reviewId],
    references: [githubPrReview.id],
  }),
}))

// PR File relationships
export const githubPrFileRelations = relations(githubPrFile, ({ one }) => ({
  githubPullRequest: one(githubPullRequest, {
    fields: [githubPrFile.pullRequestId],
    references: [githubPullRequest.id],
  }),
}))

// PR Commit relationships
export const githubPrCommitRelations = relations(githubPrCommit, ({ one }) => ({
  githubPullRequest: one(githubPullRequest, {
    fields: [githubPrCommit.pullRequestId],
    references: [githubPullRequest.id],
  }),
}))
