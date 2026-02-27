import { createFileRoute } from "@tanstack/react-router"
import {
  chatCompletion,
  isCerebrasConfigured,
  DEFAULT_MODEL,
  isValidCerebrasModelId,
} from "@/lib/cerebras"
import type { ChatMessage } from "@/lib/cerebras"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const VALID_ROLES = ["system", "user", "assistant"] as const

function parseMessages(raw: object | null | undefined): ChatMessage[] | null {
  if (!raw || !Array.isArray(raw)) return null
  const out: ChatMessage[] = []
  for (const m of raw) {
    if (!m || typeof m !== "object") return null
    const role = (m as { role?: string }).role
    const content = (m as { content?: string }).content
    if (
      typeof role !== "string" ||
      !VALID_ROLES.includes(role as (typeof VALID_ROLES)[number]) ||
      typeof content !== "string"
    ) {
      return null
    }
    out.push({ role: role as ChatMessage["role"], content })
  }
  return out.length > 0 ? out : null
}

// @ts-expect-error Route will be registered when route tree is regenerated
export const Route = createFileRoute("/api/cerebras/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        if (!isCerebrasConfigured()) {
          return jsonResponse({ error: "Cerebras API key not configured" }, 503)
        }

        const authHeader = request.headers.get("Authorization")
        const userId =
          authHeader?.startsWith("Bearer ") ? authHeader.substring("Bearer ".length) : ""
        if (!userId) {
          return jsonResponse({ error: "Unauthorized" }, 401)
        }

        let body: { messages?: object; model?: string }
        try {
          body = (await request.json()) as { messages?: object; model?: string }
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400)
        }

        const messages = parseMessages(body.messages)
        if (!messages) {
          return jsonResponse(
            {
              error:
                "messages array is required; each message must have role (system|user|assistant) and content (string)",
            },
            400,
          )
        }

        const model = body.model ?? DEFAULT_MODEL
        if (!isValidCerebrasModelId(model)) {
          return jsonResponse(
            {
              error: `Invalid model. Valid models: ${["llama-4-scout-17b-16e", "llama3.3-70b", "llama3.1-8b"].join(", ")}`,
            },
            400,
          )
        }

        try {
          const content = await chatCompletion(messages, model)
          return jsonResponse({ content })
        } catch (err) {
          const message = err instanceof Error ? err.message : "AI request failed"
          return jsonResponse({ error: message }, 500)
        }
      },
    },
  },
})
