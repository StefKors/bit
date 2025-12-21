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
  // Organization queries
  // =============================================================================
  orgs: defineQuery(() => zql.githubOrganization.orderBy("login", "asc")),

  // =============================================================================
  // Repository queries
  // =============================================================================
  repos: defineQuery(() => zql.githubRepo.orderBy("githubUpdatedAt", "desc")),

  // Get repo by fullName (owner/repo)
  repo: defineQuery(z.string(), ({ args }) => zql.githubRepo.where("fullName", "=", args).one()),

  // Get repo with pull requests - for repo detail page
  repoWithPRs: defineQuery(z.string(), ({ args }) =>
    zql.githubRepo
      .where("fullName", "=", args)
      .one()
      .related("githubPullRequest", (pr) => pr.orderBy("githubUpdatedAt", "desc")),
  ),

  // Get repo with PR with all related data - for PR detail page
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
            .related("githubPrFile")
            .related("githubPrReview")
            .related("githubPrComment"),
        ),
  ),

  // Get all repos for an owner
  reposByOwner: defineQuery(z.string(), ({ args }) =>
    zql.githubRepo.where("owner", "=", args).orderBy("githubUpdatedAt", "desc"),
  ),

  // =============================================================================
  // Pull Request queries
  // =============================================================================

  // Get all PRs for a repo
  pullRequests: defineQuery(z.string(), ({ args }) =>
    zql.githubPullRequest.where("repoId", "=", args).orderBy("githubUpdatedAt", "desc"),
  ),

  // Get basic PR info
  pr: defineQuery(z.object({ repoId: z.string().optional(), prNumber: z.number() }), ({ args }) =>
    zql.githubPullRequest
      .where("repoId", "=", args?.repoId || "__none__")
      .where("number", "=", args.prNumber)
      .one(),
  ),

  // Get full PR with all related data - for PR detail page
  // Includes: files, reviews, comments (both issue comments and review comments)
  prFull: defineQuery(
    z.object({ repoId: z.string().optional(), prNumber: z.number() }),
    ({ args }) =>
      zql.githubPullRequest
        .where("repoId", "=", args?.repoId || "__none__")
        .where("number", "=", args.prNumber)
        .one()
        .related("githubPrFile", (files) => files.orderBy("filename", "asc"))
        .related("githubPrReview", (reviews) => reviews.orderBy("submittedAt", "asc"))
        .related("githubPrComment", (comments) => comments.orderBy("githubCreatedAt", "asc")),
  ),

  // Get PR with repo info - useful for breadcrumbs
  prWithRepo: defineQuery(
    z.object({ repoId: z.string().optional(), prNumber: z.number() }),
    ({ args }) =>
      zql.githubPullRequest
        .where("repoId", "=", args?.repoId || "__none__")
        .where("number", "=", args.prNumber)
        .one()
        .related("githubRepo"),
  ),

  // =============================================================================
  // PR Files queries
  // =============================================================================
  prFiles: defineQuery(z.string(), ({ args }) =>
    zql.githubPrFile.where("pullRequestId", "=", args).orderBy("filename", "asc"),
  ),

  // =============================================================================
  // PR Reviews queries
  // =============================================================================
  reviews: defineQuery(z.string(), ({ args }) =>
    zql.githubPrReview.where("pullRequestId", "=", args).orderBy("submittedAt", "asc"),
  ),

  // Get reviews with their comments - for conversation view
  reviewsWithComments: defineQuery(z.string(), ({ args }) =>
    zql.githubPrReview
      .where("pullRequestId", "=", args)
      .orderBy("submittedAt", "asc")
      .related("githubPrComment", (comments) => comments.orderBy("githubCreatedAt", "asc")),
  ),

  // =============================================================================
  // PR Comments queries
  // =============================================================================

  // Get all comments for a PR (both issue and review comments)
  comments: defineQuery(z.string(), ({ args }) =>
    zql.githubPrComment.where("pullRequestId", "=", args).orderBy("githubCreatedAt", "asc"),
  ),

  // Get only issue comments (general PR discussion)
  issueComments: defineQuery(z.string(), ({ args }) =>
    zql.githubPrComment
      .where("pullRequestId", "=", args)
      .where("commentType", "=", "issue_comment")
      .orderBy("githubCreatedAt", "asc"),
  ),

  // Get only review comments (inline diff comments)
  reviewComments: defineQuery(z.string(), ({ args }) =>
    zql.githubPrComment
      .where("pullRequestId", "=", args)
      .where("commentType", "=", "review_comment")
      .orderBy("githubCreatedAt", "asc"),
  ),

  // Get review comments for a specific file path - for diff view
  fileComments: defineQuery(z.object({ pullRequestId: z.string(), path: z.string() }), ({ args }) =>
    zql.githubPrComment
      .where("pullRequestId", "=", args.pullRequestId)
      .where("path", "=", args.path)
      .orderBy("line", "asc"),
  ),
})
