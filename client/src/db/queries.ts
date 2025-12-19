import { defineQueries, defineQuery } from "@rocicorp/zero";
import { zql } from "./schema";

export const queries = defineQueries({
  users: {
    all: defineQuery(() => zql.user.orderBy("name", "asc")),
  },
  orgs: defineQuery(() => zql.githubOrganization.orderBy("login", "asc")),
  repos: defineQuery(() => zql.githubRepo.orderBy("githubUpdatedAt", "desc")),
  pullRequests: defineQuery(() => zql.githubPullRequest.orderBy("title", "asc")),
  reviews: defineQuery(() => zql.githubPrReview.orderBy("state", "asc")),
  comments: defineQuery(() => zql.githubPrComment.orderBy("body", "asc")),
});
