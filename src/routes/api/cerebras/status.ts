import { createFileRoute } from "@tanstack/react-router"
import { isCerebrasConfigured, CEREBRAS_MODELS, DEFAULT_MODEL } from "@/lib/cerebras"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

// @ts-expect-error Route will be registered when route tree is regenerated
export const Route = createFileRoute("/api/cerebras/status")({
  server: {
    handlers: {
      GET: () => {
        return jsonResponse({
          configured: isCerebrasConfigured(),
          models: CEREBRAS_MODELS,
          defaultModel: DEFAULT_MODEL,
        })
      },
    },
  },
})
