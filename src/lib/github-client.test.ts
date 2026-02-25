import { describe, expect, it, vi } from "vitest"
import { formatSuggestedChangeBody, GitHubClient } from "./github-client"

describe("formatSuggestedChangeBody", () => {
  it("formats a suggestion-only body", () => {
    const result = formatSuggestedChangeBody(undefined, "const next = 1")
    expect(result).toBe("```suggestion\nconst next = 1\n```")
  })

  it("includes optional comment body before suggestion block", () => {
    const result = formatSuggestedChangeBody("Please apply this.", "const next = 1")
    expect(result).toBe("Please apply this.\n\n```suggestion\nconst next = 1\n```")
  })

  it("normalizes newlines and removes trailing blank lines in suggestion", () => {
    const result = formatSuggestedChangeBody("Context", "line1\r\nline2\r\n\r\n")
    expect(result).toBe("Context\n\n```suggestion\nline1\nline2\n```")
  })
})

describe("GitHubClient review actions", () => {
  it("resolves a review thread via GraphQL for a review comment", async () => {
    const graphql = vi.fn((query: string) => {
      if (query.includes("query FindReviewThread")) {
        return {
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: [
                  {
                    id: "thread-1",
                    comments: { nodes: [{ databaseId: 123 }] },
                  },
                ],
              },
            },
          },
        }
      }
      return { resolveReviewThread: { thread: { id: "thread-1", isResolved: true } } }
    })
    const getReviewComment = vi.fn().mockResolvedValue({
      data: { id: 123, pull_request_url: "https://api.github.com/repos/owner/repo/pulls/42" },
      headers: {},
    })
    const client = new GitHubClient("token", "user-1")
    Reflect.set(client, "octokit", {
      rest: { pulls: { getReviewComment } },
      graphql,
    })

    const result = await client.updateReviewComment("owner", "repo", 123, { resolved: true })
    expect(result).toEqual({ id: 123, resolved: true })
    expect(graphql).toHaveBeenCalledTimes(2)
    expect(graphql.mock.calls[1]?.[0]).toContain("resolveReviewThread")
  })

  it("unresolves a review thread via GraphQL for a review comment", async () => {
    const graphql = vi.fn((query: string) => {
      if (query.includes("query FindReviewThread")) {
        return {
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: [
                  {
                    id: "thread-2",
                    comments: { nodes: [{ databaseId: 456 }] },
                  },
                ],
              },
            },
          },
        }
      }
      return { unresolveReviewThread: { thread: { id: "thread-2", isResolved: false } } }
    })
    const getReviewComment = vi.fn().mockResolvedValue({
      data: { id: 456, pull_request_url: "https://api.github.com/repos/owner/repo/pulls/42" },
      headers: {},
    })
    const client = new GitHubClient("token", "user-1")
    Reflect.set(client, "octokit", {
      rest: { pulls: { getReviewComment } },
      graphql,
    })

    const result = await client.updateReviewComment("owner", "repo", 456, { resolved: false })
    expect(result).toEqual({ id: 456, resolved: false })
    expect(graphql).toHaveBeenCalledTimes(2)
    expect(graphql.mock.calls[1]?.[0]).toContain("unresolveReviewThread")
  })
})
