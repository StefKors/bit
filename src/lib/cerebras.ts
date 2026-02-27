import Cerebras from "@cerebras/cerebras_cloud_sdk"

export const CEREBRAS_MODELS = [
  { id: "llama-4-scout-17b-16e", label: "Llama 4 Scout 17B", description: "Fast, capable model" },
  { id: "llama3.3-70b", label: "Llama 3.3 70B", description: "High quality reasoning" },
  { id: "llama3.1-8b", label: "Llama 3.1 8B", description: "Ultra-fast, lightweight" },
] as const

export type CerebrasModelId = (typeof CEREBRAS_MODELS)[number]["id"]

export const DEFAULT_MODEL: CerebrasModelId = "llama-4-scout-17b-16e"

let _client: Cerebras | null = null

export const getCerebrasClient = (): Cerebras | null => {
  const apiKey = process.env.CEREBRAS_API_KEY
  if (!apiKey) return null
  if (!_client) {
    _client = new Cerebras({ apiKey })
  }
  return _client
}

export const isCerebrasConfigured = (): boolean => {
  return Boolean(process.env.CEREBRAS_API_KEY)
}

export type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

export const chatCompletion = async (
  messages: ChatMessage[],
  model: string = DEFAULT_MODEL,
): Promise<string> => {
  const client = getCerebrasClient()
  if (!client) throw new Error("Cerebras API key not configured")

  const response = await client.chat.completions.create({
    messages,
    model,
    max_completion_tokens: 1024,
  })

  const choices = response.choices as Array<{ message?: { content?: string } }> | undefined
  return choices?.[0]?.message?.content ?? ""
}
