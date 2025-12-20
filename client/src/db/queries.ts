import { defineQueries, defineQuery } from "@rocicorp/zero";
import { zql } from "./schema";
import z from "zod";

export const queries = defineQueries({
  users: {
    all: defineQuery(() => zql.user.orderBy("name", "asc")),
  },
  orgs: defineQuery(() => zql.githubOrganization.orderBy("login", "asc")),
  repos: defineQuery(() => zql.githubRepo.orderBy("githubUpdatedAt", "desc")),
  repoOne: defineQuery(() => zql.githubRepo.orderBy("githubUpdatedAt", "desc")),
  repo: defineQuery(z.string(), ({ args }) => zql.githubRepo.where("fullName", "=", args).one()),
  pullRequests: defineQuery(z.string(), ({ args }) =>
    zql.githubPullRequest.where("repoId", "=", args).orderBy("githubUpdatedAt", "desc"),
  ),
  pr: defineQuery(z.object({ repoId: z.string().optional(), prNumber: z.number() }), ({ args }) =>
    zql.githubPullRequest
      .where("repoId", "=", args?.repoId || "__none__")
      .where("number", "=", args.prNumber)
      .one(),
  ),
  prFiles: defineQuery(z.string(), ({ args }) =>
    zql.githubPrFile.where("pullRequestId", "=", args).orderBy("filename", "asc"),
  ),
  reviews: defineQuery(z.string(), ({ args }) =>
    zql.githubPrReview.where("pullRequestId", "=", args).orderBy("state", "asc"),
  ),
  comments: defineQuery(z.string(), ({ args }) =>
    zql.githubPrComment.where("pullRequestId", "=", args).orderBy("body", "asc"),
  ),
  reviewComments: defineQuery(z.string(), ({ args }) =>
    zql.githubPrComment
      .where("pullRequestId", "=", args)
      .where("commentType", "=", "review_comment")
      .orderBy("githubCreatedAt", "asc"),
  ),
});
