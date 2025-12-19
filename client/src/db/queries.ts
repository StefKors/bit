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
  repo: defineQuery(z.string(), ({ args }) => zql.githubRepo.where("fullName", "=", args).limit(1)),
  pullRequests: defineQuery(z.string(), ({ args }) =>
    zql.githubPullRequest.where("repoId", "=", args).orderBy("githubUpdatedAt", "desc"),
  ),
  reviews: defineQuery(() => zql.githubPrReview.orderBy("state", "asc")),
  comments: defineQuery(() => zql.githubPrComment.orderBy("body", "asc")),
});
