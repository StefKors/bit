import Cerebras from "@cerebras/cerebras_cloud_sdk"
import type { ChatCompletionCreateParamsNonStreaming } from "@cerebras/cerebras_cloud_sdk/resources/chat"

export const CEREBRAS_MODELS = [
  {
    id: "gpt-oss-120b",
    label: "OpenAI GPT OSS",
    description: "120B params · ~3000 tok/s · Production",
  },
  {
    id: "llama3.1-8b",
    label: "Llama 3.1 8B",
    description: "8B params · ~2200 tok/s · Production",
  },
  {
    id: "qwen-3-235b-a22b-instruct-2507",
    label: "Qwen 3 235B Instruct",
    description: "235B params · ~1400 tok/s · Preview",
  },
  {
    id: "zai-glm-4.7",
    label: "Z.ai GLM 4.7",
    description: "355B params · ~1000 tok/s · Preview",
  },
] as const

export type CerebrasModelId = (typeof CEREBRAS_MODELS)[number]["id"]

export const DEFAULT_MODEL: CerebrasModelId = "gpt-oss-120b"

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

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export const isValidCerebrasModelId = (model: string): model is CerebrasModelId =>
  CEREBRAS_MODELS.some((m) => m.id === model)

export const chatCompletion = async (
  messages: ChatMessage[],
  model: string = DEFAULT_MODEL,
): Promise<string> => {
  const client = getCerebrasClient()
  if (!client) throw new Error("Cerebras API key not configured")
  if (!isValidCerebrasModelId(model)) {
    const validModels = CEREBRAS_MODELS.map((m) => m.id).join(", ")
    throw new Error(`Invalid Cerebras model: "${model}". Valid models are: ${validModels}`)
  }

  type Message = NonNullable<ChatCompletionCreateParamsNonStreaming["messages"]>[number]
  const params: ChatCompletionCreateParamsNonStreaming = {
    messages: messages as Message[],
    model,
    max_completion_tokens: 1024,
    stream: false,
  }
  const response = await client.chat.completions.create(params)

  const choices = response.choices as Array<{ message?: { content?: string } }> | undefined
  return choices?.[0]?.message?.content ?? ""
}
