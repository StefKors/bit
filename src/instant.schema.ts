import { i } from "@instantdb/react"

// =============================================================================
// InstantDB Schema
// Migrated from Drizzle schema (schema.ts)
//
// All entities include explicit timestamps since InstantDB doesn't have
// database defaults like Drizzle/PostgreSQL.
// =============================================================================

const _schema = i.schema({
  entities: {
    // Built-in user entity - maps to auth_user
    // Note: $users is system-managed, so name must be optional
    $users: i.entity({
      email: i.string().unique().indexed(),
      name: i.string().optional(),
      emailVerified: i.boolean().optional(),
      image: i.string().optional(),
      createdAt: i.number().optional(),
      updatedAt: i.number().optional(),
    }),

    // GitHub Organizations
    organizations: i.entity({
      githubId: i.number().unique().indexed(),
      login: i.string().indexed(),
      name: i.string().optional(),
      description: i.string().optional(),
      avatarUrl: i.string().optional(),
      url: i.string().optional(),
      syncedAt: i.number(),
      createdAt: i.number(),
      updatedAt: i.number(),
    }),

    // GitHub Repositories
    repos: i.entity({
      githubId: i.number().unique().indexed(),
      name: i.string().indexed(),
      fullName: i.string().indexed(), // owner/repo
      owner: i.string().indexed(),
      description: i.string().optional(),
      url: i.string().optional(),
      htmlUrl: i.string().optional(),
      private: i.boolean(),
      fork: i.boolean(),
      defaultBranch: i.string().optional(),
      language: i.string().optional(),
      stargazersCount: i.number().optional(),
      forksCount: i.number().optional(),
      openIssuesCount: i.number().optional(),
      // Denormalized userId for efficient filtering (also has user link)
      userId: i.string().indexed(),
      // GitHub timestamps (as unix timestamps)
      githubCreatedAt: i.number().optional(),
      githubUpdatedAt: i.number().optional().indexed(),
      githubPushedAt: i.number().optional().indexed(),
      // Internal timestamps
      syncedAt: i.number(),
      createdAt: i.number(),
      updatedAt: i.number(),
    }),

    // GitHub Pull Requests
    pullRequests: i.entity({
      githubId: i.number().indexed(),
      number: i.number().indexed(),
      title: i.string(),
      body: i.string().optional(),
      state: i.string().indexed(), // open, closed
      draft: i.boolean(),
      merged: i.boolean(),
      mergeable: i.boolean().optional(),
      mergeableState: i.string().optional(),
      // Author info
      authorLogin: i.string().optional().indexed(),
      authorAvatarUrl: i.string().optional(),
      // Branch info
      headRef: i.string().optional().indexed(),
      headSha: i.string().optional(),
      baseRef: i.string().optional(),
      baseSha: i.string().optional(),
      // URLs
      htmlUrl: i.string().optional(),
      diffUrl: i.string().optional(),
      // Stats
      additions: i.number().optional(),
      deletions: i.number().optional(),
      changedFiles: i.number().optional(),
      commits: i.number().optional(),
      comments: i.number().optional(),
      reviewComments: i.number().optional(),
      // Labels (stored as JSON string)
      labels: i.string().optional(),
      // Dashboard tracking: JSON array of user logins who requested review
      reviewRequestedBy: i.string().optional(),
      // Denormalized IDs for efficient filtering (also has repo/user links)
      repoId: i.string().indexed(),
      userId: i.string().indexed(),
      // Timestamps
      githubCreatedAt: i.number().optional(),
      githubUpdatedAt: i.number().optional().indexed(),
      closedAt: i.number().optional(),
      mergedAt: i.number().optional(),
      syncedAt: i.number(),
      createdAt: i.number(),
      updatedAt: i.number(),
    }),

    // GitHub PR Reviews
    prReviews: i.entity({
      githubId: i.number().indexed(),
      state: i.string().indexed(), // APPROVED, CHANGES_REQUESTED, COMMENTED, DISMISSED, PENDING
      body: i.string().optional(),
      authorLogin: i.string().optional(),
      authorAvatarUrl: i.string().optional(),
      htmlUrl: i.string().optional(),
      // Denormalized ID for efficient filtering
      pullRequestId: i.string().indexed(),
      submittedAt: i.number().optional().indexed(),
      createdAt: i.number(),
      updatedAt: i.number(),
    }),

    // GitHub PR Comments (both issue comments and review comments)
    prComments: i.entity({
      githubId: i.number().indexed(),
      commentType: i.string().indexed(), // issue_comment, review_comment
      body: i.string().optional(),
      authorLogin: i.string().optional(),
      authorAvatarUrl: i.string().optional(),
      htmlUrl: i.string().optional(),
      // For review comments (inline comments on diff)
      path: i.string().optional(),
      line: i.number().optional(),
      side: i.string().optional(), // LEFT, RIGHT
      diffHunk: i.string().optional(),
      // Denormalized ID for efficient filtering
      pullRequestId: i.string().indexed(),
      // Timestamps
      githubCreatedAt: i.number().optional().indexed(),
      githubUpdatedAt: i.number().optional(),
      createdAt: i.number(),
      updatedAt: i.number(),
    }),

    // GitHub PR Commits
    prCommits: i.entity({
      sha: i.string().indexed(),
      message: i.string(),
      authorLogin: i.string().optional(),
      authorAvatarUrl: i.string().optional(),
      authorName: i.string().optional(),
      authorEmail: i.string().optional(),
      committerLogin: i.string().optional(),
      committerAvatarUrl: i.string().optional(),
      committerName: i.string().optional(),
      committerEmail: i.string().optional(),
      htmlUrl: i.string().optional(),
      // Denormalized ID for efficient filtering
      pullRequestId: i.string().indexed(),
      committedAt: i.number().optional().indexed(),
      createdAt: i.number(),
      updatedAt: i.number(),
    }),

    // GitHub PR Files (changed files in a PR)
    prFiles: i.entity({
      sha: i.string().indexed(),
      filename: i.string().indexed(),
      status: i.string().indexed(), // added, removed, modified, renamed, copied, changed
      additions: i.number().optional(),
      deletions: i.number().optional(),
      changes: i.number().optional(),
      patch: i.string().optional(),
      previousFilename: i.string().optional(),
      blobUrl: i.string().optional(),
      rawUrl: i.string().optional(),
      contentsUrl: i.string().optional(),
      // Denormalized ID for efficient filtering
      pullRequestId: i.string().indexed(),
      createdAt: i.number(),
      updatedAt: i.number(),
    }),

    // GitHub PR Events (timeline events)
    prEvents: i.entity({
      githubId: i.number().optional(),
      eventType: i.string().indexed(), // committed, labeled, unlabeled, assigned, etc.
      // Actor info
      actorLogin: i.string().optional(),
      actorAvatarUrl: i.string().optional(),
      // Event-specific data (stored as JSON)
      eventData: i.string().optional(),
      // Common fields for specific event types
      commitSha: i.string().optional(),
      commitMessage: i.string().optional(),
      labelName: i.string().optional(),
      labelColor: i.string().optional(),
      assigneeLogin: i.string().optional(),
      assigneeAvatarUrl: i.string().optional(),
      requestedReviewerLogin: i.string().optional(),
      requestedReviewerAvatarUrl: i.string().optional(),
      // Denormalized ID for efficient filtering
      pullRequestId: i.string().indexed(),
      // Timestamps
      eventCreatedAt: i.number().optional().indexed(),
      createdAt: i.number(),
      updatedAt: i.number(),
    }),

    // GitHub Issues
    issues: i.entity({
      githubId: i.number().indexed(),
      number: i.number().indexed(),
      title: i.string(),
      body: i.string().optional(),
      state: i.string().indexed(), // open, closed
      stateReason: i.string().optional(), // completed, not_planned, reopened
      // Author info
      authorLogin: i.string().optional().indexed(),
      authorAvatarUrl: i.string().optional(),
      // URLs
      htmlUrl: i.string().optional(),
      // Stats
      comments: i.number().optional(),
      // Labels (stored as JSON string)
      labels: i.string().optional(),
      // Assignees (stored as JSON string)
      assignees: i.string().optional(),
      // Milestone
      milestone: i.string().optional(),
      // Denormalized IDs for efficient filtering
      repoId: i.string().indexed(),
      userId: i.string().indexed(),
      // Timestamps
      githubCreatedAt: i.number().optional(),
      githubUpdatedAt: i.number().optional().indexed(),
      closedAt: i.number().optional(),
      syncedAt: i.number(),
      createdAt: i.number(),
      updatedAt: i.number(),
    }),

    // GitHub Issue Comments
    issueComments: i.entity({
      githubId: i.number().indexed(),
      body: i.string().optional(),
      authorLogin: i.string().optional(),
      authorAvatarUrl: i.string().optional(),
      htmlUrl: i.string().optional(),
      // Denormalized ID for efficient filtering
      issueId: i.string().indexed(),
      // Timestamps
      githubCreatedAt: i.number().optional().indexed(),
      githubUpdatedAt: i.number().optional(),
      createdAt: i.number(),
      updatedAt: i.number(),
    }),

    // GitHub Repository Tree Entries
    repoTrees: i.entity({
      ref: i.string().indexed(), // branch name or commit sha
      path: i.string().indexed(), // full path from root
      name: i.string(), // file/directory name
      type: i.string().indexed(), // 'file' or 'dir'
      sha: i.string().indexed(), // git blob/tree sha
      size: i.number().optional(), // file size in bytes (null for directories)
      url: i.string().optional(), // API URL
      htmlUrl: i.string().optional(), // GitHub web URL
      // Denormalized ID for efficient filtering
      repoId: i.string().indexed(),
      createdAt: i.number(),
      updatedAt: i.number(),
    }),

    // GitHub Repository Blob Content
    repoBlobs: i.entity({
      sha: i.string().indexed(),
      content: i.string().optional(), // file content (base64 decoded)
      encoding: i.string().optional(), // usually 'base64' or 'utf-8'
      size: i.number().optional(),
      // Denormalized ID for efficient filtering
      repoId: i.string().indexed(),
      createdAt: i.number(),
      updatedAt: i.number(),
    }),

    // GitHub Sync State
    syncStates: i.entity({
      resourceType: i.string().indexed(), // overview, repo:{fullName}, pr:{repoId}:{number}
      resourceId: i.string().optional().indexed(),
      lastSyncedAt: i.number().optional(),
      lastEtag: i.string().optional(),
      // Rate limit info
      rateLimitRemaining: i.number().optional(),
      rateLimitReset: i.number().optional(),
      // Sync status
      syncStatus: i.string().optional(), // idle, syncing, error
      syncError: i.string().optional(),
      // Denormalized ID for efficient filtering
      userId: i.string().indexed(),
      createdAt: i.number(),
      updatedAt: i.number(),
    }),
  },

  links: {
    // User -> Organizations (one-to-many)
    userOrganizations: {
      forward: {
        on: "organizations",
        has: "one",
        label: "user",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "organizations",
      },
    },

    // User -> Repos (one-to-many)
    userRepos: {
      forward: {
        on: "repos",
        has: "one",
        label: "user",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "repos",
      },
    },

    // Organization -> Repos (one-to-many)
    orgRepos: {
      forward: {
        on: "repos",
        has: "one",
        label: "organization",
      },
      reverse: {
        on: "organizations",
        has: "many",
        label: "repos",
      },
    },

    // Repo -> Pull Requests (one-to-many)
    repoPullRequests: {
      forward: {
        on: "pullRequests",
        has: "one",
        label: "repo",
      },
      reverse: {
        on: "repos",
        has: "many",
        label: "pullRequests",
      },
    },

    // User -> Pull Requests (one-to-many)
    userPullRequests: {
      forward: {
        on: "pullRequests",
        has: "one",
        label: "user",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "pullRequests",
      },
    },

    // Pull Request -> Reviews (one-to-many)
    prReviewsLink: {
      forward: {
        on: "prReviews",
        has: "one",
        label: "pullRequest",
      },
      reverse: {
        on: "pullRequests",
        has: "many",
        label: "prReviews",
      },
    },

    // User -> Reviews (one-to-many)
    userReviews: {
      forward: {
        on: "prReviews",
        has: "one",
        label: "user",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "prReviews",
      },
    },

    // Pull Request -> Comments (one-to-many)
    prCommentsLink: {
      forward: {
        on: "prComments",
        has: "one",
        label: "pullRequest",
      },
      reverse: {
        on: "pullRequests",
        has: "many",
        label: "prComments",
      },
    },

    // Review -> Comments (one-to-many, optional)
    reviewComments: {
      forward: {
        on: "prComments",
        has: "one",
        label: "review",
      },
      reverse: {
        on: "prReviews",
        has: "many",
        label: "prComments",
      },
    },

    // User -> Comments (one-to-many)
    userComments: {
      forward: {
        on: "prComments",
        has: "one",
        label: "user",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "prComments",
      },
    },

    // Pull Request -> Commits (one-to-many)
    prCommitsLink: {
      forward: {
        on: "prCommits",
        has: "one",
        label: "pullRequest",
      },
      reverse: {
        on: "pullRequests",
        has: "many",
        label: "prCommits",
      },
    },

    // User -> Commits (one-to-many)
    userCommits: {
      forward: {
        on: "prCommits",
        has: "one",
        label: "user",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "prCommits",
      },
    },

    // Pull Request -> Files (one-to-many)
    prFilesLink: {
      forward: {
        on: "prFiles",
        has: "one",
        label: "pullRequest",
      },
      reverse: {
        on: "pullRequests",
        has: "many",
        label: "prFiles",
      },
    },

    // User -> Files (one-to-many)
    userFiles: {
      forward: {
        on: "prFiles",
        has: "one",
        label: "user",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "prFiles",
      },
    },

    // Pull Request -> Events (one-to-many)
    prEventsLink: {
      forward: {
        on: "prEvents",
        has: "one",
        label: "pullRequest",
      },
      reverse: {
        on: "pullRequests",
        has: "many",
        label: "prEvents",
      },
    },

    // User -> Events (one-to-many)
    userEvents: {
      forward: {
        on: "prEvents",
        has: "one",
        label: "user",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "prEvents",
      },
    },

    // Repo -> Issues (one-to-many)
    repoIssues: {
      forward: {
        on: "issues",
        has: "one",
        label: "repo",
      },
      reverse: {
        on: "repos",
        has: "many",
        label: "issues",
      },
    },

    // User -> Issues (one-to-many)
    userIssues: {
      forward: {
        on: "issues",
        has: "one",
        label: "user",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "issues",
      },
    },

    // Issue -> Comments (one-to-many)
    issueCommentsLink: {
      forward: {
        on: "issueComments",
        has: "one",
        label: "issue",
      },
      reverse: {
        on: "issues",
        has: "many",
        label: "issueComments",
      },
    },

    // User -> Issue Comments (one-to-many)
    userIssueComments: {
      forward: {
        on: "issueComments",
        has: "one",
        label: "user",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "issueComments",
      },
    },

    // Repo -> Tree Entries (one-to-many)
    repoTreeEntries: {
      forward: {
        on: "repoTrees",
        has: "one",
        label: "repo",
      },
      reverse: {
        on: "repos",
        has: "many",
        label: "repoTrees",
      },
    },

    // User -> Tree Entries (one-to-many)
    userTreeEntries: {
      forward: {
        on: "repoTrees",
        has: "one",
        label: "user",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "repoTrees",
      },
    },

    // Repo -> Blobs (one-to-many)
    repoBlobs: {
      forward: {
        on: "repoBlobs",
        has: "one",
        label: "repo",
      },
      reverse: {
        on: "repos",
        has: "many",
        label: "repoBlobs",
      },
    },

    // User -> Blobs (one-to-many)
    userBlobs: {
      forward: {
        on: "repoBlobs",
        has: "one",
        label: "user",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "repoBlobs",
      },
    },

    // User -> Sync States (one-to-many)
    userSyncStates: {
      forward: {
        on: "syncStates",
        has: "one",
        label: "user",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "syncStates",
      },
    },
  },
})

type _AppSchema = typeof _schema
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema

export type { AppSchema }
export default schema
