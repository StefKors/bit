interface WebhookRegistrationConfig {
  enabled: boolean
  webhookUrl: string | null
  reason?: string
}

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"])

const isPrivateIpv4 = (hostname: string): boolean => {
  const parts = hostname.split(".").map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false

  const [a, b] = parts
  if (a === 10) return true
  if (a === 127) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 169 && b === 254) return true
  return false
}

const isLocalOrPrivateHostname = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase()
  if (LOCAL_HOSTNAMES.has(normalized)) return true
  if (normalized.endsWith(".local")) return true
  if (isPrivateIpv4(normalized)) return true
  return false
}

const parseBooleanEnv = (value: string | undefined): boolean => {
  if (!value) return false
  return value.toLowerCase() === "true" || value === "1"
}

export const getWebhookRegistrationConfig = (
  env: Record<string, string | undefined> = process.env,
): WebhookRegistrationConfig => {
  const baseUrl = env.BASE_URL
  const webhookSecret = env.GITHUB_WEBHOOK_SECRET
  const allowLocalWebhookRegistration = parseBooleanEnv(env.ALLOW_LOCAL_WEBHOOK_REGISTRATION)

  if (!baseUrl || !webhookSecret) {
    return {
      enabled: false,
      webhookUrl: null,
      reason: "BASE_URL or GITHUB_WEBHOOK_SECRET not configured",
    }
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(baseUrl)
  } catch {
    return {
      enabled: false,
      webhookUrl: null,
      reason: "BASE_URL is not a valid URL",
    }
  }

  if (isLocalOrPrivateHostname(parsedUrl.hostname) && !allowLocalWebhookRegistration) {
    return {
      enabled: false,
      webhookUrl: null,
      reason:
        "Webhook registration disabled for local/private BASE_URL. Set ALLOW_LOCAL_WEBHOOK_REGISTRATION=true to override.",
    }
  }

  return {
    enabled: true,
    webhookUrl: `${baseUrl}/api/github/webhook`,
  }
}
