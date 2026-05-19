import type { AssistantToolPreference } from '../../types/assistant.types'
import type {
  ChatConversationCompactionLike,
  ChatMessage,
} from '../../types/chat'
import type { ChatModel } from '../../types/chat-model.types'
import type { ContextualInjection } from '../../utils/chat/contextual-injections'
import { RequestContextBuilder } from '../../utils/chat/requestContextBuilder'
import { estimateJsonTokens } from '../../utils/llm/contextTokenEstimate'
import { McpManager } from '../mcp/mcpManager'

import {
  buildDeferredToolCatalogItems,
  extractLoadedDeferredToolNames,
} from './tool-disclosure'
import {
  getToolApprovalModeForCatalog,
  selectAllowedTools,
} from './tool-selection'

export const estimateContinuationRequestContextTokens = async ({
  requestContextBuilder,
  mcpManager,
  model,
  messages,
  conversationId,
  compaction,
  enableTools,
  includeBuiltinTools,
  allowedToolNames,
  toolPreferences,
  allowedSkillIds,
  allowedSkillNames,
  contextualInjections,
}: {
  requestContextBuilder: RequestContextBuilder
  mcpManager: McpManager
  model: ChatModel
  messages: ChatMessage[]
  conversationId: string
  compaction?: ChatConversationCompactionLike | null
  enableTools: boolean
  includeBuiltinTools: boolean
  allowedToolNames?: string[]
  toolPreferences?: Record<string, AssistantToolPreference>
  allowedSkillIds?: string[]
  allowedSkillNames?: string[]
  contextualInjections?: ContextualInjection[]
}): Promise<number> => {
  const availableTools = enableTools
    ? await mcpManager.listAvailableTools({
        includeBuiltinTools,
        // Tailor built-in tool schemas to the active model so the token
        // estimate reflects what the model will actually see at request time.
        chatModelModalities: model.modalities,
      })
    : []
  const { hasTools, hasMemoryTools, deferredTools, requestTools } =
    selectAllowedTools({
      availableTools,
      allowedToolNames,
      allowedSkillIds,
      allowedSkillNames,
      toolPreferences,
      loadedToolNames: extractLoadedDeferredToolNames({ messages, compaction }),
    })
  const deferredCatalogItems = buildDeferredToolCatalogItems(
    deferredTools.map((tool) => ({
      tool,
      approvalMode: getToolApprovalModeForCatalog(toolPreferences, tool.name),
    })),
  )

  const requestMessages = await requestContextBuilder.generateRequestMessages({
    messages,
    hasTools,
    hasMemoryTools,
    model,
    conversationId,
    compaction,
    contextualInjections:
      deferredCatalogItems.length > 0
        ? [
            ...(contextualInjections ?? []),
            { type: 'deferred-tool-catalog', tools: deferredCatalogItems },
          ]
        : contextualInjections,
  })

  return await estimateJsonTokens({
    messages: requestMessages,
    tools: requestTools,
  })
}
