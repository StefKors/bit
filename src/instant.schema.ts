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
  },
})

export type AppSchema = typeof schema
export default schema
