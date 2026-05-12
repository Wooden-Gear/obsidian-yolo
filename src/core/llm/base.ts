import { ChatModel } from '../../types/chat-model.types'
import {
  LLMOptions,
  LLMRequestNonStreaming,
  LLMRequestStreaming,
} from '../../types/llm/request'
import {
  LLMResponseNonStreaming,
  LLMResponseStreaming,
} from '../../types/llm/response'
import { LLMProvider } from '../../types/provider.types'
import { parseCustomParameterValue } from '../../utils/custom-parameters'

/**
 * Whether to log each provider's request body right after customParameters
 * merge. Driven by `settings.debug.logModelRequestContext`; kept module-local
 * instead of threading settings through every provider constructor since this
 * is a debug affordance, not a feature gate.
 *
 * IMPORTANT: this is NOT the absolute final on-wire payload — some providers
 * (notably the OpenAI Responses path and the OpenAI-compatible adapter) do
 * additional shape transforms inside `adapter.buildRequest` (e.g. folding
 * `extra_body.tools` into the top-level `tools`) after this point. For a
 * truly authoritative view, the browser Network tab is still the source of
 * truth. This log is intended to make the customParameters merge step
 * inspectable, which is where the historical "tools silently overwritten"
 * bug lived.
 */
let logRequestAfterCustomParams = false

export function setLogFinalRequestPayloadEnabled(enabled: boolean): void {
  logRequestAfterCustomParams = enabled
}

// TODO: do these really have to be class? why not just function?
export abstract class BaseLLMProvider<P extends LLMProvider> {
  protected readonly provider: P
  constructor(provider: P) {
    this.provider = provider
  }

  abstract generateResponse(
    model: ChatModel,
    request: LLMRequestNonStreaming,
    options?: LLMOptions,
  ): Promise<LLMResponseNonStreaming>

  abstract streamResponse(
    model: ChatModel,
    request: LLMRequestStreaming,
    options?: LLMOptions,
  ): Promise<AsyncIterable<LLMResponseStreaming>>

  abstract getEmbedding(
    model: string,
    text: string,
    options?: { dimensions?: number },
  ): Promise<number[]>

  protected applyCustomModelParameters<T extends Record<string, unknown>>(
    model: ChatModel,
    request: T,
  ): T {
    const entries = Array.isArray(model.customParameters)
      ? model.customParameters
      : []

    const next: Record<string, unknown> = { ...request }
    for (const entry of entries) {
      const key = typeof entry?.key === 'string' ? entry.key.trim() : ''
      if (!key) continue
      const rawValue = typeof entry?.value === 'string' ? entry.value : ''
      if (rawValue.trim().length === 0) {
        continue
      }
      const parsed = parseCustomParameterValue(rawValue, entry.type, key)
      const existing = next[key]
      // The `tools` field is a true set across the OpenAI/OpenRouter/Anthropic
      // family: built-in (hosted) provider tools must coexist with agent
      // function-calling tools in the same array slot. Overwrite semantics
      // would silently drop the agent's tools whenever a user adds e.g.
      // `tools=[{type:"openrouter:web_search"}]` via custom parameters, so for
      // this one key we append instead of replace.
      //
      // Other array-typed request fields (`messages`, `stop_sequences`,
      // `modalities`, etc.) are NOT free-form sets — appending would corrupt
      // their semantics — so they intentionally stay on overwrite semantics.
      if (key === 'tools' && Array.isArray(parsed) && Array.isArray(existing)) {
        next[key] = [...existing, ...parsed]
      } else {
        next[key] = parsed
      }
    }

    if (logRequestAfterCustomParams) {
      // Fires every call when debug logging is enabled — including when there
      // are no customParameters — so the log is also a useful checkpoint
      // showing "what each provider sees just before adapter serialization".
      // See module-level comment for what this is NOT (the absolute on-wire
      // payload).
      console.debug(
        `[YOLO][LLM Debug] Request after customParameters (${this.provider.id} / ${model.id})`,
        next,
      )
    }

    return next as T
  }
}
