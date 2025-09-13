import OpenAI from 'openai'

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
import { formatMessages } from '../../utils/llm/request'

import { BaseLLMProvider } from './base'
import { LLMBaseUrlNotSetException } from './exception'
import { NoStainlessOpenAI } from './NoStainlessOpenAI'
import { OpenAIMessageAdapter } from './openaiMessageAdapter'

export class OpenAICompatibleProvider extends BaseLLMProvider<
  Extract<LLMProvider, { type: 'openai-compatible' }>
> {
  private adapter: OpenAIMessageAdapter
  private client: OpenAI

  constructor(provider: Extract<LLMProvider, { type: 'openai-compatible' }>) {
    super(provider)
    this.adapter = new OpenAIMessageAdapter()
    this.client = new (
      provider.additionalSettings?.noStainless ? NoStainlessOpenAI : OpenAI
    )({
      apiKey: provider.apiKey ?? '',
      baseURL: provider.baseUrl ? provider.baseUrl?.replace(/\/+$/, '') : '',
      dangerouslyAllowBrowser: true,
    })
  }

  async generateResponse(
    model: ChatModel,
    request: LLMRequestNonStreaming,
    options?: LLMOptions,
  ): Promise<LLMResponseNonStreaming> {
    if (model.providerType !== 'openai-compatible') {
      throw new Error('Model is not an OpenAI Compatible model')
    }

    if (!this.provider.baseUrl) {
      throw new LLMBaseUrlNotSetException(
        `Provider ${this.provider.id} base URL is missing. Please set it in settings menu.`,
      )
    }

    const formattedRequest: any = {
      ...request,
      messages: formatMessages(request.messages),
    }
    
    // Handle Gemini native tools for OpenAI-compatible gateways
    // Important: DO NOT set top-level `tools` to Gemini objects; gateways may
    // interpret them as OpenAI function declarations. Instead, pass via extra_body.
    if ((model as any).toolType === 'gemini' && (options as any)?.geminiTools) {
      const gemTools = (options as any).geminiTools
      const geminiNativeTools: any[] = []
      if (gemTools.useWebSearch) {
        // Provide both snake_case (REST) and camelCase (JS SDK) variants
        geminiNativeTools.push({ google_search: {} })
        geminiNativeTools.push({ googleSearch: {} })
      }
      if (gemTools.useUrlContext) {
        geminiNativeTools.push({ url_context: {} })
        geminiNativeTools.push({ urlContext: {} })
      }
      if (geminiNativeTools.length > 0) {
        const camelTools: any[] = []
        if (gemTools.useWebSearch) camelTools.push({ googleSearch: {} })
        if (gemTools.useUrlContext) camelTools.push({ urlContext: {} })
        ;(formattedRequest as any).extra_body = {
          ...(formattedRequest as any).extra_body,
          tools: geminiNativeTools, // REST-compatible
          config: {
            ...((formattedRequest as any).extra_body?.config || {}),
            tools: camelTools, // JS SDK-compatible
          },
          gemini: {
            ...((formattedRequest as any).extra_body?.gemini || {}),
            tools: camelTools,
          },
        }
      }
      // Ensure no top-level OpenAI tool fields are sent when using Gemini tools
      delete (formattedRequest as any).tools
      delete (formattedRequest as any).tool_choice
    }
    // If toolType is Gemini but no Gemini tools enabled, also ensure top-level tools are unset
    else if ((model as any).toolType === 'gemini') {
      delete (formattedRequest as any).tools
    }
    
    // Inject Gemini thinking config for OpenAI-compatible gateways if user selected Gemini reasoning
    if ((model as any).thinking?.enabled) {
      const budget = (model as any).thinking.thinking_budget
      // Use both snake_case and camelCase to maximize compatibility
      formattedRequest.thinking_config = { thinking_budget: budget, include_thoughts: true }
      formattedRequest.thinkingConfig = { thinkingBudget: budget, includeThoughts: true }
    }
    // Inject OpenAI reasoning effort for compatible gateways if user enabled OpenAI reasoning
    if ((model as any).reasoning?.enabled) {
      const effort = (model as any).reasoning.reasoning_effort
      if (effort) {
        // Pass the flat field (widely supported by OpenAI-compatible proxies)
        formattedRequest.reasoning_effort = effort
        // Also add a nested object for gateways that prefer `reasoning: { effort }`
        formattedRequest.reasoning = { effort }
      }
      // Ensure no top-level OpenAI tools are sent when using Gemini tools
      delete (formattedRequest as any).tools
    }
    // If toolType is Gemini but no Gemini tools enabled, also ensure top-level tools are unset
    else if ((model as any).toolType === 'gemini') {
      delete (formattedRequest as any).tools
    }
    return this.adapter.generateResponse(this.client, formattedRequest, options)
  }

  async streamResponse(
    model: ChatModel,
    request: LLMRequestStreaming,
    options?: LLMOptions,
  ): Promise<AsyncIterable<LLMResponseStreaming>> {
    if (model.providerType !== 'openai-compatible') {
      throw new Error('Model is not an OpenAI Compatible model')
    }

    if (!this.provider.baseUrl) {
      throw new LLMBaseUrlNotSetException(
        `Provider ${this.provider.id} base URL is missing. Please set it in settings menu.`,
      )
    }

    const formattedRequest: any = {
      ...request,
      messages: formatMessages(request.messages),
    }
    
    // Handle Gemini native tools for OpenAI-compatible gateways (streaming)
    if ((model as any).toolType === 'gemini' && (options as any)?.geminiTools) {
      const gemTools = (options as any).geminiTools
      const geminiNativeTools: any[] = []
      if (gemTools.useWebSearch) {
        geminiNativeTools.push({ google_search: {} })
        geminiNativeTools.push({ googleSearch: {} })
      }
      if (gemTools.useUrlContext) {
        geminiNativeTools.push({ url_context: {} })
        geminiNativeTools.push({ urlContext: {} })
      }
      if (geminiNativeTools.length > 0) {
        ;(formattedRequest as any).extra_body = {
          ...(formattedRequest as any).extra_body,
          tools: geminiNativeTools,
        }
      }
      // Ensure no top-level OpenAI tools are sent when using Gemini tools
      delete (formattedRequest as any).tools
    } else if ((model as any).toolType === 'gemini') {
      // Ensure no top-level tools when Gemini tool type but none enabled
      delete (formattedRequest as any).tools
    }
    
    if ((model as any).thinking?.enabled) {
      const budget = (model as any).thinking.thinking_budget
      formattedRequest.thinking_config = { thinking_budget: budget, include_thoughts: true }
      formattedRequest.thinkingConfig = { thinkingBudget: budget, includeThoughts: true }
    }
    if ((model as any).reasoning?.enabled) {
      const effort = (model as any).reasoning.reasoning_effort
      if (effort) {
        formattedRequest.reasoning_effort = effort
        formattedRequest.reasoning = { effort }
      }
    }
    return this.adapter.streamResponse(this.client, formattedRequest, options)
  }

  async getEmbedding(model: string, text: string): Promise<number[]> {
    const embedding = await this.client.embeddings.create({
      model: model,
      input: text,
      encoding_format: 'float',
    })
    return embedding.data[0].embedding
  }
}
