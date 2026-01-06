// =============================================================================
// InstantDB Permissions
// Row-level security using data.ref for linked attributes
// =============================================================================

export default {
  // Organizations: user can only access their own
  organizations: {
    allow: {
      view: "auth.id in data.ref('user.id')",
      create: "auth.id != null",
      update: "auth.id in data.ref('user.id')",
      delete: "auth.id in data.ref('user.id')",
    },
  },

  // Repos: user can only access their own
  repos: {
    allow: {
      view: "auth.id in data.ref('user.id')",
      create: "auth.id != null",
      update: "auth.id in data.ref('user.id')",
      delete: "auth.id in data.ref('user.id')",
    },
  },

  // Pull Requests: user can only access their own
  pullRequests: {
    allow: {
      view: "auth.id in data.ref('user.id')",
      create: "auth.id != null",
      update: "auth.id in data.ref('user.id')",
      delete: "auth.id in data.ref('user.id')",
    },
  },

  // PR Reviews: user can only access their own
  prReviews: {
    allow: {
      view: "auth.id in data.ref('user.id')",
      create: "auth.id != null",
      update: "auth.id in data.ref('user.id')",
      delete: "auth.id in data.ref('user.id')",
    },
  },

  // PR Comments: user can only access their own
  prComments: {
    allow: {
      view: "auth.id in data.ref('user.id')",
      create: "auth.id != null",
      update: "auth.id in data.ref('user.id')",
      delete: "auth.id in data.ref('user.id')",
    },
  },

  // PR Commits: user can only access their own
  prCommits: {
    allow: {
      view: "auth.id in data.ref('user.id')",
      create: "auth.id != null",
      update: "auth.id in data.ref('user.id')",
      delete: "auth.id in data.ref('user.id')",
    },
  },

  // PR Files: user can only access their own
  prFiles: {
    allow: {
      view: "auth.id in data.ref('user.id')",
      create: "auth.id != null",
      update: "auth.id in data.ref('user.id')",
      delete: "auth.id in data.ref('user.id')",
    },
  },

  // PR Events: user can only access their own
  prEvents: {
    allow: {
      view: "auth.id in data.ref('user.id')",
      create: "auth.id != null",
      update: "auth.id in data.ref('user.id')",
      delete: "auth.id in data.ref('user.id')",
    },
  },

  // Issues: user can only access their own
  issues: {
    allow: {
      view: "auth.id in data.ref('user.id')",
      create: "auth.id != null",
      update: "auth.id in data.ref('user.id')",
      delete: "auth.id in data.ref('user.id')",
    },
  },

  // Issue Comments: user can only access their own
  issueComments: {
    allow: {
      view: "auth.id in data.ref('user.id')",
      create: "auth.id != null",
      update: "auth.id in data.ref('user.id')",
      delete: "auth.id in data.ref('user.id')",
    },
  },

  // Repo Trees: user can only access their own
  repoTrees: {
    allow: {
      view: "auth.id in data.ref('user.id')",
      create: "auth.id != null",
      update: "auth.id in data.ref('user.id')",
      delete: "auth.id in data.ref('user.id')",
    },
  },

  // Repo Blobs: user can only access their own
  repoBlobs: {
    allow: {
      view: "auth.id in data.ref('user.id')",
      create: "auth.id != null",
      update: "auth.id in data.ref('user.id')",
      delete: "auth.id in data.ref('user.id')",
    },
  },

  // Sync States: user can only access their own
  syncStates: {
    allow: {
      view: "auth.id in data.ref('user.id')",
      create: "auth.id != null",
      update: "auth.id in data.ref('user.id')",
      delete: "auth.id in data.ref('user.id')",
    },
  },
}
