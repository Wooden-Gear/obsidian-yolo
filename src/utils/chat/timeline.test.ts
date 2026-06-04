import type {
  AssistantToolMessageGroup,
  ChatToolMessage,
} from '../../types/chat'
import { ToolCallResponseStatus } from '../../types/tool-call.types'

import { buildMessageTimelineItems } from './timeline'

function makeToolMessage({
  id,
  toolCallCount,
  responseText,
}: {
  id: string
  toolCallCount: number
  responseText: string
}): ChatToolMessage {
  return {
    role: 'tool',
    id,
    toolCalls: Array.from({ length: toolCallCount }, (_, index) => ({
      request: {
        id: `${id}-call-${index}`,
        name: 'Bash',
        arguments: {
          kind: 'complete',
          value: { command: `echo ${index}` },
        },
      },
      response: {
        status: ToolCallResponseStatus.Success,
        data: {
          type: 'text',
          text: responseText,
        },
      },
    })),
  }
}

function getAssistantGroupEstimate(group: AssistantToolMessageGroup): number {
  const item = buildMessageTimelineItems({
    groupedChatMessages: [group],
  })[0]

  if (!item || item.kind !== 'assistant-group') {
    throw new Error('Expected assistant-group timeline item')
  }

  return item.estimatedHeight
}

describe('buildMessageTimelineItems', () => {
  it('estimates collapsed tool cards by count instead of response payload size', () => {
    const smallPayloadEstimate = getAssistantGroupEstimate([
      makeToolMessage({
        id: 'small-tool',
        toolCallCount: 12,
        responseText: 'ok',
      }),
    ])
    const largePayloadEstimate = getAssistantGroupEstimate([
      makeToolMessage({
        id: 'large-tool',
        toolCallCount: 12,
        responseText: 'x'.repeat(80_000),
      }),
    ])

    expect(largePayloadEstimate).toBe(smallPayloadEstimate)
    expect(largePayloadEstimate).toBeLessThan(1000)
  })
})
