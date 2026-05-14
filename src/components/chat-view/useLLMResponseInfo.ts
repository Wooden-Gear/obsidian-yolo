import { useMemo } from 'react'

import {
  AssistantToolMessageGroup,
  ChatAssistantMessage,
} from '../../types/chat'
import { ChatModel } from '../../types/chat-model.types'
import { ResponseUsage } from '../../types/llm/response'
import { calculateLLMCost } from '../../utils/llm/price-calculator'

export type LLMResponseInfoEntry = {
  messageId: string
  requestNumber: number
  usage: ResponseUsage | null
  model: ChatModel | undefined
  cost: number | null
  durationMs: number | null
}

export type LLMResponseInfo = {
  requests: LLMResponseInfoEntry[]
  usage: ResponseUsage | null
  model: ChatModel | undefined
  cost: number | null
  durationMs: number | null
}

const addOptionalUsageTokenCount = (
  target: {
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  },
  key: 'cache_read_input_tokens' | 'cache_creation_input_tokens',
  value: number | undefined,
) => {
  if (typeof value !== 'number' || value <= 0) {
    return
  }
  target[key] = (target[key] ?? 0) + value
}

const sumUsages = (usages: ResponseUsage[]): ResponseUsage | null => {
  if (usages.length === 0) {
    return null
  }

  const total: ResponseUsage = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  }

  for (const usage of usages) {
    total.prompt_tokens += usage.prompt_tokens
    total.completion_tokens += usage.completion_tokens
    total.total_tokens += usage.total_tokens
    addOptionalUsageTokenCount(
      total,
      'cache_read_input_tokens',
      usage.cache_read_input_tokens,
    )
    addOptionalUsageTokenCount(
      total,
      'cache_creation_input_tokens',
      usage.cache_creation_input_tokens,
    )
  }

  return total
}

export function collectLLMResponseInfo(
  messages: AssistantToolMessageGroup,
): LLMResponseInfo {
  const requests: LLMResponseInfoEntry[] = []
  let latestAssistantMessage: ChatAssistantMessage | undefined
  let latestAssistantWithUsage: ChatAssistantMessage | undefined
  let totalDurationMs = 0
  let hasDuration = false

  for (const message of messages) {
    if (message.role !== 'assistant') {
      continue
    }

    latestAssistantMessage = message

    if (message.metadata?.usage) {
      latestAssistantWithUsage = message
    }

    const usage = message.metadata?.usage ?? null
    const durationMs =
      typeof message.metadata?.durationMs === 'number'
        ? message.metadata.durationMs
        : null

    if (durationMs !== null) {
      totalDurationMs += durationMs
      hasDuration = true
    }

    if (!usage && durationMs === null) {
      continue
    }

    const model = message.metadata?.model
    requests.push({
      messageId: message.id,
      requestNumber: requests.length + 1,
      usage,
      model,
      cost:
        usage && model
          ? calculateLLMCost({
              model,
              usage,
            })
          : null,
      durationMs,
    })
  }

  const usage = sumUsages(
    requests
      .map((request) => request.usage)
      .filter((requestUsage): requestUsage is ResponseUsage =>
        Boolean(requestUsage),
      ),
  )

  const model =
    latestAssistantWithUsage?.metadata?.model ??
    latestAssistantMessage?.metadata?.model

  let totalCost = 0
  let hasCost = false
  let hasUnknownCost = false
  for (const request of requests) {
    if (!request.usage) {
      continue
    }
    if (request.cost === null) {
      hasUnknownCost = true
      continue
    }
    hasCost = true
    totalCost += request.cost
  }

  return {
    requests,
    usage,
    model,
    cost: hasCost && !hasUnknownCost ? totalCost : null,
    durationMs: hasDuration ? totalDurationMs : null,
  }
}

export function useLLMResponseInfo(
  messages: AssistantToolMessageGroup,
): LLMResponseInfo {
  return useMemo(() => collectLLMResponseInfo(messages), [messages])
}
