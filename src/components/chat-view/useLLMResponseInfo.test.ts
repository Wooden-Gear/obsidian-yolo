import type { ChatAssistantMessage, ChatToolMessage } from '../../types/chat'
import type { ChatModel } from '../../types/chat-model.types'
import type { ResponseUsage } from '../../types/llm/response'
import { ToolCallResponseStatus } from '../../types/tool-call.types'

import { collectLLMResponseInfo } from './useLLMResponseInfo'

const model: ChatModel = {
  id: 'model-1',
  providerId: 'chatgpt-oauth/default',
  model: 'gpt-test',
  name: 'GPT Test',
}

const makeAssistant = (
  id: string,
  promptTokens: number,
  completionTokens: number,
  durationMs: number,
  extraUsage: Partial<ResponseUsage> = {},
): ChatAssistantMessage => ({
  role: 'assistant',
  id,
  content: '',
  metadata: {
    model,
    durationMs,
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
      ...extraUsage,
    },
  },
})

const toolMessage: ChatToolMessage = {
  role: 'tool',
  id: 'tool-1',
  toolCalls: [
    {
      request: {
        id: 'tool-call-1',
        name: 'tool',
        arguments: {
          kind: 'complete',
          value: {},
          rawText: '{}',
        },
      },
      response: {
        status: ToolCallResponseStatus.Success,
        data: {
          type: 'text',
          text: 'ok',
        },
      },
    },
  ],
}

describe('collectLLMResponseInfo', () => {
  it('sums usage across all assistant requests in a tool-calling group', () => {
    const info = collectLLMResponseInfo([
      makeAssistant('assistant-1', 100, 20, 1000, {
        cache_read_input_tokens: 10,
      }),
      toolMessage,
      makeAssistant('assistant-2', 200, 30, 1500, {
        cache_creation_input_tokens: 15,
      }),
    ])

    expect(info.requests).toHaveLength(2)
    expect(info.requests.map((request) => request.messageId)).toEqual([
      'assistant-1',
      'assistant-2',
    ])
    expect(info.usage).toEqual({
      prompt_tokens: 300,
      completion_tokens: 50,
      total_tokens: 350,
      cache_read_input_tokens: 10,
      cache_creation_input_tokens: 15,
    })
    expect(info.durationMs).toBe(2500)
    expect(info.cost).toBe(0)
  })
})
