import { describe, it, expect } from "vitest"
import { parseScopes, checkPermissions } from "./github-permissions"

describe("parseScopes", () => {
  it("parses comma-separated scopes", () => {
    expect(parseScopes("repo, read:org, read:user")).toEqual(["repo", "read:org", "read:user"])
  })

  it("handles scopes without spaces", () => {
    expect(parseScopes("repo,read:org")).toEqual(["repo", "read:org"])
  })

  it("returns empty array for empty string", () => {
    expect(parseScopes("")).toEqual([])
  })

  it("returns empty array for null", () => {
    expect(parseScopes(null)).toEqual([])
  })

  it("returns empty array for undefined", () => {
    expect(parseScopes(undefined)).toEqual([])
  })

  it("filters out empty entries", () => {
    expect(parseScopes("repo,,read:org")).toEqual(["repo", "read:org"])
  })

  it("parses whitespace-delimited scopes", () => {
    expect(parseScopes("repo read:org read:user")).toEqual(["repo", "read:org", "read:user"])
  })

  it("deduplicates repeated scopes", () => {
    expect(parseScopes("repo,repo,read:org repo")).toEqual(["repo", "read:org"])
  })
})

describe("checkPermissions", () => {
  it("reports all granted when all scopes present", () => {
    const report = checkPermissions(["repo", "read:org", "read:user", "user:email"])
    expect(report.allGranted).toBe(true)
    expect(report.missingScopes).toEqual([])
    expect(report.scopes.every((s) => s.status === "granted")).toBe(true)
  })

  it("reports missing scopes", () => {
    const report = checkPermissions(["read:user"])
    expect(report.allGranted).toBe(false)
    expect(report.missingScopes).toEqual(["repo", "read:org", "user:email", "admin:repo_hook"])
  })

  it("reports all missing when no scopes granted", () => {
    const report = checkPermissions([])
    expect(report.allGranted).toBe(false)
    expect(report.missingScopes).toHaveLength(5)
  })

  it("includes descriptions for each scope", () => {
    const report = checkPermissions([])
    for (const scope of report.scopes) {
      expect(scope.description).toBeTruthy()
    }
  })

  it("ignores extra scopes not in required list", () => {
    const report = checkPermissions(["repo", "read:org", "read:user", "user:email", "admin:org"])
    expect(report.allGranted).toBe(true)
    expect(report.grantedScopes).toContain("admin:org")
  })

  it("treats repo as satisfying admin:repo_hook", () => {
    const report = checkPermissions(["repo", "read:org", "read:user", "user:email"])
    const webhookScope = report.scopes.find((scope) => scope.scope === "admin:repo_hook")
    expect(webhookScope?.status).toBe("granted")
  })

  it("treats user as satisfying read:user and user:email", () => {
    const report = checkPermissions(["repo", "read:org", "user"])
    expect(report.allGranted).toBe(true)
  })
})
