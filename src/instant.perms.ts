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
}
