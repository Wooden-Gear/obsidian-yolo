import type {
  ChatConversationCompactionLike,
  ChatMessage,
} from '../../types/chat'
import { getLatestChatConversationCompaction } from '../../types/chat'
import type { McpTool } from '../../types/mcp.types'
import { ToolCallResponseStatus } from '../../types/tool-call.types'

export const TOOL_SEARCH_RESULT_TOOL = 'tool_search'

export type DeferredToolCatalogItem = {
  name: string
  description: string
  approvalMode: 'full_access' | 'require_approval'
  source: string
}

export const buildDeferredToolCatalogItems = (
  tools: Array<{
    tool: McpTool
    approvalMode: 'full_access' | 'require_approval'
  }>,
): DeferredToolCatalogItem[] =>
  tools.map(({ tool, approvalMode }) => ({
    name: tool.name,
    description: tool.description ?? '',
    approvalMode,
    source: getToolSource(tool.name),
  }))

export const extractLoadedDeferredToolNames = ({
  messages,
  compaction,
}: {
  messages: ChatMessage[]
  compaction?: ChatConversationCompactionLike | null
}): Set<string> => {
  const loaded = new Set<string>()
  const latestCompaction = getLatestChatConversationCompaction(compaction)
  for (const name of latestCompaction?.loadedDeferredToolNames ?? []) {
    loaded.add(name)
  }

  for (const message of messages) {
    if (message.role !== 'tool') {
      continue
    }
    for (const toolCall of message.toolCalls) {
      if (toolCall.response.status !== ToolCallResponseStatus.Success) {
        continue
      }
      const text = toolCall.response.data.text
      try {
        const parsed = JSON.parse(text) as {
          tool?: unknown
          loadedToolNames?: unknown
        }
        if (parsed.tool !== TOOL_SEARCH_RESULT_TOOL) {
          continue
        }
        if (!Array.isArray(parsed.loadedToolNames)) {
          continue
        }
        for (const name of parsed.loadedToolNames) {
          if (typeof name === 'string' && name.trim().length > 0) {
            loaded.add(name)
          }
        }
      } catch {
        // Non-JSON tool results are unrelated to tool disclosure state.
      }
    }
  }

  return loaded
}

const getToolSource = (toolName: string): string => {
  const parts = toolName.split('__')
  if (parts.length >= 2 && parts[0]) {
    return parts[0]
  }
  return 'tool'
}
