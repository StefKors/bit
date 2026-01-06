import { defineQueries, defineQuery } from "@rocicorp/zero"
import { zql } from "./schema"
import z from "zod"

/**
 * Zero queries with row-level security via context filtering.
 *
 * All queries filter by ctx.userID to ensure users only see their own data.
 * This is the new Zero permissions model - no RLS, filter in queries instead.
 *
 * @see https://zero.rocicorp.dev/docs/auth#permissions
 */
export const queries = defineQueries({
  // =============================================================================
  // User queries
  // =============================================================================
  users: {
    // Users can only see themselves
    all: defineQuery(({ ctx }) =>
      zql.user.where("id", "=", ctx.userID ?? "").orderBy("name", "asc"),
    ),
  },

  // =============================================================================
  // Overview page - fetch repos with orgs in one go
  // =============================================================================
  overview: defineQuery(({ ctx }) =>
    zql.githubRepo
      .where("userId", "=", ctx.userID ?? "")
      .orderBy("githubPushedAt", "desc")
      .related("githubOrganization"),
  ),

  // =============================================================================
  // Dashboard PRs - authored by user (filter by authorLogin)
  // =============================================================================
  dashboardAuthored: defineQuery(z.string(), ({ ctx, args: authorLogin }) =>
    zql.githubPullRequest
      .where("userId", "=", ctx.userID ?? "")
      .where("authorLogin", "=", authorLogin)
      .where("state", "=", "open")
      .orderBy("githubUpdatedAt", "desc")
      .related("githubRepo"),
  ),

  // =============================================================================
  // Dashboard PRs - all open PRs (for filtering review-requested client-side)
  // =============================================================================
  dashboardAllOpen: defineQuery(({ ctx }) =>
    zql.githubPullRequest
      .where("userId", "=", ctx.userID ?? "")
      .where("state", "=", "open")
      .orderBy("githubUpdatedAt", "desc")
      .related("githubRepo"),
  ),

  // =============================================================================
  // Owner page - fetch org with all repos in one go
  // =============================================================================
  ownerWithRepos: defineQuery(z.string(), ({ ctx, args }) =>
    zql.githubOrganization
      .where("userId", "=", ctx.userID ?? "")
      .where("login", "=", args)
      .one()
      .related("githubRepo", (repos) => repos.orderBy("githubPushedAt", "desc")),
  ),

  // Repos by owner - includes related organization for profile info
  reposByOwner: defineQuery(z.string(), ({ ctx, args }) =>
    zql.githubRepo
      .where("userId", "=", ctx.userID ?? "")
      .where("owner", "=", args)
      .orderBy("githubPushedAt", "desc")
      .related("githubOrganization"),
  ),

  // =============================================================================
  // Repo page - fetch repo with PRs and Issues in one go (used by RepoLayout)
  // =============================================================================
  repoWithPRsAndIssues: defineQuery(z.string(), ({ ctx, args }) =>
    zql.githubRepo
      .where("userId", "=", ctx.userID ?? "")
      .where("fullName", "=", args)
      .one()
      .related("githubPullRequest", (pr) => pr.orderBy("githubUpdatedAt", "desc"))
      .related("githubIssue", (issue) => issue.orderBy("githubUpdatedAt", "desc")),
  ),

  // =============================================================================
  // Repo tree - fetch tree entries for a specific ref
  // =============================================================================
  repoTree: defineQuery(z.object({ repoId: z.string(), ref: z.string() }), ({ ctx, args }) =>
    zql.githubRepoTree
      .where("userId", "=", ctx.userID ?? "")
      .where("repoId", "=", args.repoId)
      .where("ref", "=", args.ref)
      .orderBy("path", "asc"),
  ),

  // Repo blob - fetch file content by sha
  repoBlob: defineQuery(z.object({ repoId: z.string(), sha: z.string() }), ({ ctx, args }) =>
    zql.githubRepoBlob
      .where("userId", "=", ctx.userID ?? "")
      .where("repoId", "=", args.repoId)
      .where("sha", "=", args.sha)
      .one(),
  ),

  // =============================================================================
  // PR detail page - fetch repo with single PR and all its related data
  // =============================================================================
  repoWithPRFull: defineQuery(
    z.object({ fullName: z.string(), prNumber: z.number() }),
    ({ ctx, args }) =>
      zql.githubRepo
        .where("userId", "=", ctx.userID ?? "")
        .where("fullName", "=", args.fullName)
        .one()
        .related("githubPullRequest", (pr) =>
          pr
            .where("number", "=", args.prNumber)
            .one()
            .related("githubPrFile", (files) => files.orderBy("filename", "asc"))
            .related("githubPrReview", (reviews) => reviews.orderBy("submittedAt", "asc"))
            .related("githubPrComment", (comments) => comments.orderBy("githubCreatedAt", "asc"))
            .related("githubPrCommit", (commits) => commits.orderBy("committedAt", "asc"))
            .related("githubPrEvent", (events) => events.orderBy("eventCreatedAt", "asc")),
        ),
  ),

  // =============================================================================
  // Issue detail page - fetch repo with single issue and all its comments
  // =============================================================================
  repoWithIssueFull: defineQuery(
    z.object({ fullName: z.string(), issueNumber: z.number() }),
    ({ ctx, args }) =>
      zql.githubRepo
        .where("userId", "=", ctx.userID ?? "")
        .where("fullName", "=", args.fullName)
        .one()
        .related("githubIssue", (issue) =>
          issue
            .where("number", "=", args.issueNumber)
            .one()
            .related("githubIssueComment", (comments) =>
              comments.orderBy("githubCreatedAt", "asc"),
            ),
        ),
  ),
})
