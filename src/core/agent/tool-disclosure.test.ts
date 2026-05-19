import type { ChatMessage } from '../../types/chat'
import { ToolCallResponseStatus } from '../../types/tool-call.types'

import { extractLoadedDeferredToolNames } from './tool-disclosure'

describe('tool disclosure state', () => {
  it('extracts loaded tool names from tool_search results', () => {
    const messages: ChatMessage[] = [
      {
        role: 'tool',
        id: 'tool-1',
        toolCalls: [
          {
            request: {
              id: 'call-1',
              name: 'yolo_local__tool_search',
            },
            response: {
              status: ToolCallResponseStatus.Success,
              data: {
                type: 'text',
                text: JSON.stringify({
                  tool: 'tool_search',
                  loadedToolNames: ['server__tool_a'],
                }),
              },
            },
          },
        ],
      },
    ]

    expect([...extractLoadedDeferredToolNames({ messages })]).toEqual([
      'server__tool_a',
    ])
  })

  it('carries loaded tool names from compaction metadata', () => {
    expect([
      ...extractLoadedDeferredToolNames({
        messages: [],
        compaction: {
          anchorMessageId: 'a1',
          summary: 'summary',
          compactedAt: 1,
          loadedDeferredToolNames: ['server__tool_a'],
        },
      }),
    ]).toEqual(['server__tool_a'])
  })
})
