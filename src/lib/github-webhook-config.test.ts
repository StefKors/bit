import { describe, expect, it } from "vitest"
import { getWebhookRegistrationConfig } from "./github-webhook-config"

describe("getWebhookRegistrationConfig", () => {
  it("disables registration when required env vars are missing", () => {
    const config = getWebhookRegistrationConfig({})
    expect(config.enabled).toBe(false)
    expect(config.reason).toContain("BASE_URL or GITHUB_WEBHOOK_SECRET not configured")
  })

  it("disables registration for localhost BASE_URL by default", () => {
    const config = getWebhookRegistrationConfig({
      BASE_URL: "http://localhost:5173",
      GITHUB_WEBHOOK_SECRET: "secret",
    })
    expect(config.enabled).toBe(false)
    expect(config.reason).toContain("local/private BASE_URL")
  })

  it("disables registration for private network IP by default", () => {
    const config = getWebhookRegistrationConfig({
      BASE_URL: "http://192.168.1.22:5173",
      GITHUB_WEBHOOK_SECRET: "secret",
    })
    expect(config.enabled).toBe(false)
    expect(config.reason).toContain("local/private BASE_URL")
  })

  it("enables registration for public BASE_URL", () => {
    const config = getWebhookRegistrationConfig({
      BASE_URL: "https://app.example.com",
      GITHUB_WEBHOOK_SECRET: "secret",
    })
    expect(config.enabled).toBe(true)
    expect(config.webhookUrl).toBe("https://app.example.com/api/github/webhook")
  })

  it("allows localhost override when explicitly enabled", () => {
    const config = getWebhookRegistrationConfig({
      BASE_URL: "http://localhost:5173",
      GITHUB_WEBHOOK_SECRET: "secret",
      ALLOW_LOCAL_WEBHOOK_REGISTRATION: "true",
    })
    expect(config.enabled).toBe(true)
    expect(config.webhookUrl).toBe("http://localhost:5173/api/github/webhook")
  })
})
