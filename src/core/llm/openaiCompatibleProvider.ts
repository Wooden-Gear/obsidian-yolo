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
    // Prefer standard OpenAI SDK; allow opting into NoStainless to bypass headers/validation when needed
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

    let formattedRequest: any = {
      ...request,
      messages: formatMessages(request.messages),
    }

    // Handle Gemini tools for OpenAI-compatible gateways
    if ((model as any).toolType === 'gemini' && (options as any)?.geminiTools) {
      const gemTools = (options as any).geminiTools
      const openaiTools: any[] = []

      if (gemTools.useWebSearch) {
        openaiTools.push({
          type: 'function',
          function: {
            name: 'googleSearch',
            description: 'Search the web using Google Search',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query',
                },
              },
              required: ['query'],
            },
          },
        })
      }

      if (gemTools.useUrlContext) {
        openaiTools.push({
          type: 'function',
          function: {
            name: 'urlContext',
            description: 'Get context from a URL',
            parameters: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'The URL to get context from',
                },
              },
              required: ['url'],
            },
          },
        })
      }

      if (openaiTools.length > 0) {
        formattedRequest.tools = openaiTools
      }
    }
    // If toolType is Gemini but no Gemini tools enabled, also ensure top-level tools are unset
    else if ((model as any).toolType === 'gemini') {
      delete formattedRequest.tools
    }

    // Inject Gemini thinking config for OpenAI-compatible gateways if user selected Gemini reasoning
    if ((model as any).thinking?.enabled) {
      const budget = (model as any).thinking.thinking_budget
      // Use both snake_case and camelCase to maximize compatibility
      formattedRequest.thinking_config = {
        thinking_budget: budget,
        include_thoughts: true,
      }
      formattedRequest.thinkingConfig = {
        thinkingBudget: budget,
        includeThoughts: true,
      }
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
    }
    formattedRequest = this.applyCustomModelParameters(model, formattedRequest)
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

    let formattedRequest: any = {
      ...request,
      messages: formatMessages(request.messages),
    }

    // Handle Gemini tools for OpenAI-compatible gateways (streaming)
    if ((model as any).toolType === 'gemini' && (options as any)?.geminiTools) {
      const gemTools = (options as any).geminiTools
      const openaiTools: any[] = []

      if (gemTools.useWebSearch) {
        openaiTools.push({
          type: 'function',
          function: {
            name: 'googleSearch',
            description: 'Search the web using Google Search',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query',
                },
              },
              required: ['query'],
            },
          },
        })
      }

      if (gemTools.useUrlContext) {
        openaiTools.push({
          type: 'function',
          function: {
            name: 'urlContext',
            description: 'Get context from a URL',
            parameters: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'The URL to get context from',
                },
              },
              required: ['url'],
            },
          },
        })
      }

      if (openaiTools.length > 0) {
        formattedRequest.tools = openaiTools
      }
    }
    if (
      (model as any).toolType === 'gemini' &&
      !(options as any)?.geminiTools
    ) {
      // Ensure no top-level tools when Gemini tool type but none enabled
      delete formattedRequest.tools
    }

    if ((model as any).thinking?.enabled) {
      const budget = (model as any).thinking.thinking_budget
      formattedRequest.thinking_config = {
        thinking_budget: budget,
        include_thoughts: true,
      }
      formattedRequest.thinkingConfig = {
        thinkingBudget: budget,
        includeThoughts: true,
      }
    }
    if ((model as any).reasoning?.enabled) {
      const effort = (model as any).reasoning.reasoning_effort
      if (effort) {
        formattedRequest.reasoning_effort = effort
        formattedRequest.reasoning = { effort }
      }
    }
    formattedRequest = this.applyCustomModelParameters(model, formattedRequest)
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
