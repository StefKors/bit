export const requireWebhookOpsAuth = (request: Request): Response | null => {
  const opsToken = process.env.WEBHOOK_OPS_TOKEN
  if (!opsToken) return null

  const authHeader =
    request.headers.get("authorization") || request.headers.get("Authorization") || ""
  const bearerToken = authHeader.replace("Bearer ", "")
  const headerToken = request.headers.get("x-webhook-ops-token") || ""
  const provided = headerToken || bearerToken

  if (provided && provided === opsToken) return null

  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  })
}
