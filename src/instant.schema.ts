import { i } from "@instantdb/react"

// =============================================================================
// InstantDB Schema - Minimal for auth + GitHub App install
// =============================================================================

export const schema = i.schema({
  entities: {
    $users: i.entity({
      email: i.string().unique().indexed(),
      name: i.string().optional(),
      emailVerified: i.boolean().optional(),
      createdAt: i.number().optional(),
      updatedAt: i.number().optional(),
      // GitHub User fields (from install callback)
      login: i.string().unique().indexed().optional(),
      githubId: i.number().unique().indexed().optional(),
      nodeId: i.string().optional(),
      avatarUrl: i.string().optional(),
      gravatarId: i.string().optional(),
      url: i.string().optional(),
      htmlUrl: i.string().optional(),
      followersUrl: i.string().optional(),
      followingUrl: i.string().optional(),
      gistsUrl: i.string().optional(),
      starredUrl: i.string().optional(),
      subscriptionsUrl: i.string().optional(),
      organizationsUrl: i.string().optional(),
      reposUrl: i.string().optional(),
      eventsUrl: i.string().optional(),
      receivedEventsUrl: i.string().optional(),
      type: i.string().optional(),
      siteAdmin: i.boolean().optional(),
      githubAccessToken: i.string().optional(),
    }),

    syncStates: i.entity({
      resourceType: i.string().indexed(),
      resourceId: i.string().optional().indexed(),
      lastSyncedAt: i.number().optional(),
      lastEtag: i.string().optional(),
      syncStatus: i.string().optional(),
      syncError: i.string().optional(),
      userId: i.string().indexed(),
      createdAt: i.number(),
      updatedAt: i.number(),
    }),

    repos: i.entity({
      nodeId: i.string().unique().indexed(),
      fullName: i.string().indexed(),
      name: i.string().indexed(),
      owner: i.string().indexed(),
      private: i.boolean().optional(),
      description: i.string().optional(),
      htmlUrl: i.string().optional(),
      pushedAt: i.number().optional().indexed(),
      stargazersCount: i.number().optional(),
      forksCount: i.number().optional(),
      language: i.string().optional(),
      defaultBranch: i.string().optional(),
      createdAt: i.number(),
      updatedAt: i.number(),
    }),

    pullRequests: i.entity({
      nodeId: i.string().unique().indexed().optional(),
      number: i.number().indexed(),
      title: i.string().optional(),
      body: i.string().optional(),
      state: i.string().optional().indexed(),
      draft: i.boolean().optional().indexed(),
      locked: i.boolean().optional(),
      merged: i.boolean().optional(),
      mergeable: i.boolean().optional(),
      mergeableState: i.string().optional().indexed(),
      htmlUrl: i.string().optional(),
      authorLogin: i.string().optional().indexed(),
      authorAvatarUrl: i.string().optional(),
      baseRef: i.string().optional(),
      baseSha: i.string().optional(),
      headRef: i.string().optional(),
      headSha: i.string().optional().indexed(),
      commentsCount: i.number().optional(),
      reviewCommentsCount: i.number().optional(),
      commitsCount: i.number().optional(),
      additions: i.number().optional(),
      deletions: i.number().optional(),
      changedFiles: i.number().optional(),
      labels: i.string().optional(),
      assignees: i.string().optional(),
      requestedReviewers: i.string().optional(),
      githubCreatedAt: i.number().optional(),
      githubUpdatedAt: i.number().optional().indexed(),
      githubClosedAt: i.number().optional(),
      githubMergedAt: i.number().optional(),
      mergedByLogin: i.string().optional(),
      mergedByAvatarUrl: i.string().optional(),
      payload: i.string().optional(),
      createdAt: i.number(),
      updatedAt: i.number().indexed(),
    }),

    pullRequestReviews: i.entity({
      githubId: i.number().unique().indexed(),
      nodeId: i.string().optional(),
      state: i.string().optional().indexed(),
      body: i.string().optional(),
      authorLogin: i.string().optional().indexed(),
      authorAvatarUrl: i.string().optional(),
      submittedAt: i.number().optional(),
      htmlUrl: i.string().optional(),
      payload: i.string().optional(),
      createdAt: i.number(),
      updatedAt: i.number().indexed(),
    }),

    pullRequestReviewComments: i.entity({
      githubId: i.number().unique().indexed(),
      nodeId: i.string().optional(),
      body: i.string().optional(),
      path: i.string().optional().indexed(),
      line: i.number().optional(),
      side: i.string().optional(),
      inReplyToId: i.number().optional(),
      authorLogin: i.string().optional().indexed(),
      authorAvatarUrl: i.string().optional(),
      htmlUrl: i.string().optional(),
      payload: i.string().optional(),
      createdAt: i.number(),
      updatedAt: i.number().indexed(),
    }),

    issueComments: i.entity({
      githubId: i.number().unique().indexed(),
      nodeId: i.string().optional(),
      body: i.string().optional(),
      authorLogin: i.string().optional().indexed(),
      authorAvatarUrl: i.string().optional(),
      htmlUrl: i.string().optional(),
      payload: i.string().optional(),
      createdAt: i.number(),
      updatedAt: i.number().indexed(),
    }),

    pullRequestReviewThreads: i.entity({
      threadId: i.string().unique().indexed(),
      resolved: i.boolean().optional().indexed(),
      payload: i.string().optional(),
      createdAt: i.number(),
      updatedAt: i.number().indexed(),
    }),

    checkRuns: i.entity({
      githubId: i.number().unique().indexed(),
      nodeId: i.string().optional(),
      name: i.string().optional().indexed(),
      status: i.string().optional().indexed(),
      conclusion: i.string().optional().indexed(),
      detailsUrl: i.string().optional(),
      htmlUrl: i.string().optional(),
      startedAt: i.number().optional(),
      completedAt: i.number().optional(),
      payload: i.string().optional(),
      createdAt: i.number(),
      updatedAt: i.number().indexed(),
    }),

    checkSuites: i.entity({
      githubId: i.number().unique().indexed(),
      nodeId: i.string().optional(),
      status: i.string().optional().indexed(),
      conclusion: i.string().optional().indexed(),
      headSha: i.string().optional().indexed(),
      branch: i.string().optional().indexed(),
      appName: i.string().optional(),
      payload: i.string().optional(),
      createdAt: i.number(),
      updatedAt: i.number().indexed(),
    }),

    pushEvents: i.entity({
      pushKey: i.string().unique().indexed(),
      ref: i.string().optional().indexed(),
      beforeSha: i.string().optional(),
      afterSha: i.string().optional().indexed(),
      forced: i.boolean().optional(),
      created: i.boolean().optional(),
      deleted: i.boolean().optional(),
      compareUrl: i.string().optional(),
      commitsCount: i.number().optional(),
      payload: i.string().optional(),
      createdAt: i.number(),
      updatedAt: i.number().indexed(),
    }),

    pullRequestCommits: i.entity({
      sha: i.string().indexed(),
      message: i.string().optional(),
      messageShort: i.string().optional(),
      authorLogin: i.string().optional().indexed(),
      authorAvatarUrl: i.string().optional(),
      authoredAt: i.number().optional().indexed(),
      htmlUrl: i.string().optional(),
      createdAt: i.number(),
      updatedAt: i.number().indexed(),
    }),
    pullRequestFiles: i.entity({
      commitSha: i.string().indexed(),
      filename: i.string().indexed(),
      previousFilename: i.string().optional(),
      status: i.string().indexed(),
      additions: i.number().optional(),
      deletions: i.number().optional(),
      patch: i.string().optional(),
      createdAt: i.number(),
      updatedAt: i.number().indexed(),
    }),
  },

  links: {
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
    userRepos: {
      forward: {
        on: "repos",
        has: "many",
        label: "users",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "repos",
      },
    },
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
    pullRequestReviewsLink: {
      forward: {
        on: "pullRequestReviews",
        has: "one",
        label: "pullRequest",
      },
      reverse: {
        on: "pullRequests",
        has: "many",
        label: "pullRequestReviews",
      },
    },
    pullRequestReviewCommentsLink: {
      forward: {
        on: "pullRequestReviewComments",
        has: "one",
        label: "pullRequest",
      },
      reverse: {
        on: "pullRequests",
        has: "many",
        label: "pullRequestReviewComments",
      },
    },
    pullRequestIssueCommentsLink: {
      forward: {
        on: "issueComments",
        has: "one",
        label: "pullRequest",
      },
      reverse: {
        on: "pullRequests",
        has: "many",
        label: "issueComments",
      },
    },
    pullRequestReviewThreadsLink: {
      forward: {
        on: "pullRequestReviewThreads",
        has: "one",
        label: "pullRequest",
      },
      reverse: {
        on: "pullRequests",
        has: "many",
        label: "pullRequestReviewThreads",
      },
    },
    pullRequestCheckRunsLink: {
      forward: {
        on: "checkRuns",
        has: "one",
        label: "pullRequest",
      },
      reverse: {
        on: "pullRequests",
        has: "many",
        label: "checkRuns",
      },
    },
    pullRequestCheckSuitesLink: {
      forward: {
        on: "checkSuites",
        has: "one",
        label: "pullRequest",
      },
      reverse: {
        on: "pullRequests",
        has: "many",
        label: "checkSuites",
      },
    },
    repoPushEvents: {
      forward: {
        on: "pushEvents",
        has: "one",
        label: "repo",
      },
      reverse: {
        on: "repos",
        has: "many",
        label: "pushEvents",
      },
    },
    pullRequestCommitsLink: {
      forward: {
        on: "pullRequestCommits",
        has: "one",
        label: "pullRequest",
      },
      reverse: {
        on: "pullRequests",
        has: "many",
        label: "pullRequestCommits",
      },
    },
    pullRequestFilesLink: {
      forward: {
        on: "pullRequestFiles",
        has: "one",
        label: "pullRequest",
      },
      reverse: {
        on: "pullRequests",
        has: "many",
        label: "pullRequestFiles",
      },
    },
  },
})

export type AppSchema = typeof schema
export default schema
