import { createFileRoute } from "@tanstack/react-router"

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () => {
        return jsonResponse({
          status: "ok",
          timestamp: new Date().toISOString(),
        })
      },
    },
  },
})
