// =============================================================================
// InstantDB Permissions - Minimal for auth + GitHub App install
// =============================================================================

export default {
  syncStates: {
    allow: {
      view: "auth.id in data.ref('user.id')",
      create: "auth.id != null",
      update: "auth.id in data.ref('user.id')",
      delete: "auth.id in data.ref('user.id')",
    },
  },
  repos: {
    allow: {
      view: "auth.id in data.ref('users.id')",
      create: "auth.id != null",
      update: "auth.id in data.ref('users.id')",
      delete: "auth.id in data.ref('users.id')",
    },
  },
  webhookEvents: {
    allow: {
      view: "auth.id in data.ref('repo.users.id')",
      create: "false",
      update: "false",
      delete: "false",
    },
  },
  pullRequests: {
    allow: {
      view: "auth.id in data.ref('repo.users.id')",
      create: "false",
      update: "false",
      delete: "false",
    },
  },
  pullRequestReviews: {
    allow: {
      view: "auth.id in data.ref('pullRequest.repo.users.id')",
      create: "false",
      update: "false",
      delete: "false",
    },
  },
  pullRequestReviewComments: {
    allow: {
      view: "auth.id in data.ref('pullRequest.repo.users.id')",
      create: "false",
      update: "false",
      delete: "false",
    },
  },
  issueComments: {
    allow: {
      view: "auth.id in data.ref('pullRequest.repo.users.id')",
      create: "false",
      update: "false",
      delete: "false",
    },
  },
  pullRequestReviewThreads: {
    allow: {
      view: "auth.id in data.ref('pullRequest.repo.users.id')",
      create: "false",
      update: "false",
      delete: "false",
    },
  },
  checkRuns: {
    allow: {
      view: "auth.id in data.ref('pullRequest.repo.users.id')",
      create: "false",
      update: "false",
      delete: "false",
    },
  },
  checkSuites: {
    allow: {
      view: "auth.id in data.ref('pullRequest.repo.users.id')",
      create: "false",
      update: "false",
      delete: "false",
    },
  },
  pushEvents: {
    allow: {
      view: "auth.id in data.ref('repo.users.id')",
      create: "false",
      update: "false",
      delete: "false",
    },
  },
}
