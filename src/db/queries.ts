import { defineQueries, defineQuery } from "@rocicorp/zero"
import { zql } from "./schema"
import z from "zod"

export const queries = defineQueries({
  // =============================================================================
  // User queries
  // =============================================================================
  users: {
    all: defineQuery(() => zql.user.orderBy("name", "asc")),
  },

  // =============================================================================
  // Overview page - fetch repos with orgs in one go
  // =============================================================================
  overview: defineQuery(() =>
    zql.githubRepo.orderBy("githubUpdatedAt", "desc").related("githubOrganization"),
  ),

  // =============================================================================
  // Dashboard PRs - authored by user (filter by authorLogin)
  // =============================================================================
  dashboardAuthored: defineQuery(z.string(), ({ args: authorLogin }) =>
    zql.githubPullRequest
      .where("authorLogin", "=", authorLogin)
      .where("state", "=", "open")
      .orderBy("githubUpdatedAt", "desc")
      .related("githubRepo"),
  ),

  // =============================================================================
  // Dashboard PRs - all open PRs (for filtering review-requested client-side)
  // =============================================================================
  dashboardAllOpen: defineQuery(() =>
    zql.githubPullRequest
      .where("state", "=", "open")
      .orderBy("githubUpdatedAt", "desc")
      .related("githubRepo"),
  ),

  // =============================================================================
  // Owner page - fetch org with all repos in one go
  // =============================================================================
  ownerWithRepos: defineQuery(z.string(), ({ args }) =>
    zql.githubOrganization
      .where("login", "=", args)
      .one()
      .related("githubRepo", (repos) => repos.orderBy("githubUpdatedAt", "desc")),
  ),

  // Fallback for user repos (not org) - repos by owner
  reposByOwner: defineQuery(z.string(), ({ args }) =>
    zql.githubRepo.where("owner", "=", args).orderBy("githubUpdatedAt", "desc"),
  ),

  // =============================================================================
  // Repo page - fetch repo with PRs in one go (used by RepoLayout)
  // =============================================================================
  repoWithPRs: defineQuery(z.string(), ({ args }) =>
    zql.githubRepo
      .where("fullName", "=", args)
      .one()
      .related("githubPullRequest", (pr) => pr.orderBy("githubUpdatedAt", "desc")),
  ),

  // =============================================================================
  // PR detail page - fetch repo with single PR and all its related data
  // =============================================================================
  repoWithPRFull: defineQuery(
    z.object({ fullName: z.string(), prNumber: z.number() }),
    ({ args }) =>
      zql.githubRepo
        .where("fullName", "=", args.fullName)
        .one()
        .related("githubPullRequest", (pr) =>
          pr
            .where("number", "=", args.prNumber)
            .one()
            .related("githubPrFile", (files) => files.orderBy("filename", "asc"))
            .related("githubPrReview", (reviews) => reviews.orderBy("submittedAt", "asc"))
            .related("githubPrComment", (comments) => comments.orderBy("githubCreatedAt", "asc"))
            .related("githubPrCommit", (commits) => commits.orderBy("committedAt", "asc")),
        ),
  ),
})
