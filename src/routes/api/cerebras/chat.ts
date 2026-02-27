import { createFileRoute } from "@tanstack/react-router"
import { chatCompletion, isCerebrasConfigured, DEFAULT_MODEL } from "@/lib/cerebras"
import type { ChatMessage } from "@/lib/cerebras"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

// @ts-expect-error Route will be registered when route tree is regenerated
export const Route = createFileRoute("/api/cerebras/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        if (!isCerebrasConfigured()) {
          return jsonResponse({ error: "Cerebras API key not configured" }, 503)
        }

        let body: { messages?: ChatMessage[]; model?: string }
        try {
          body = (await request.json()) as { messages?: ChatMessage[]; model?: string }
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400)
        }

        const { messages, model } = body
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          return jsonResponse({ error: "messages array is required" }, 400)
        }

        try {
          const content = await chatCompletion(messages, model ?? DEFAULT_MODEL)
          return jsonResponse({ content })
        } catch (err) {
          const message = err instanceof Error ? err.message : "AI request failed"
          return jsonResponse({ error: message }, 500)
        }
      },
    },
  },
})
