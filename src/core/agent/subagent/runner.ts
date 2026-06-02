import { v4 as uuidv4 } from 'uuid'

import type { TaskSource } from '../../../types/chat'
import type { ChatMessage, ChatUserMessage } from '../../../types/chat'
import { ToolCallResponseStatus } from '../../../types/tool-call.types'
import { formatErrorMessageWithCauses } from '../../../utils/error-message'
import { CitationRegistry } from '../citationRegistry'
import { NativeAgentRuntime } from '../native-runtime'
import type { AgentRuntimeLoopConfig, AgentRuntimeRunInput } from '../types'

import {
  SUBAGENT_DEFAULT_SYSTEM_PROMPT,
  SUBAGENT_MAX_AUTO_ITERATIONS,
} from './constants'
import type { SubagentParentContext } from './parent-context'
import { subagentStreamBus } from './stream-bus'
import { subagentTaskRegistry } from './task-registry'
import { filterAllowedToolsForSubagent } from './tool-filter'
import type {
  SubagentAcceptedResult,
  SubagentResult,
  SubagentTaskRecord,
} from './types'

export type RunSubagentParams = {
  description: string
  prompt: string
  conversationId: string
  source: TaskSource
  parent: SubagentParentContext
  signal?: AbortSignal
}

function countToolUses(messages: ChatMessage[]): number {
  return messages.reduce((count, message) => {
    if (message.role !== 'tool') {
      return count
    }
    return (
      count +
      message.toolCalls.filter(
        (toolCall) => toolCall.response.status === ToolCallResponseStatus.Success,
      ).length
    )
  }, 0)
}

function extractLastAssistantText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.role === 'assistant' && message.content.trim().length > 0) {
      return message.content.trim()
    }
  }
  return ''
}

function extractLastAssistantUsage(
  messages: ChatMessage[],
): SubagentResult['usage'] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.role === 'assistant' && message.metadata?.usage) {
      return message.metadata.usage
    }
  }
  return undefined
}

async function runChildAgent(
  record: SubagentTaskRecord,
  parent: SubagentParentContext,
): Promise<void> {
  const startedAt = record.createdAt
  const childUserMessage: ChatUserMessage = {
    role: 'user',
    id: uuidv4(),
    content: null,
    promptContent: record.prompt,
    mentionables: [],
  }

  const childAllowedToolNames = filterAllowedToolsForSubagent(
    parent.allowedToolNames,
  )

  const loopConfig: AgentRuntimeLoopConfig = {
    enableTools: parent.loopConfig.enableTools,
    includeBuiltinTools: parent.loopConfig.includeBuiltinTools,
    maxAutoIterations: SUBAGENT_MAX_AUTO_ITERATIONS,
  }

  const runtime = new NativeAgentRuntime(loopConfig)
  const citationRegistry = new CitationRegistry()
  const abortController = record.abortController

  const runInput: AgentRuntimeRunInput = {
    providerClient: parent.providerClient,
    model: parent.model,
    apiType: parent.apiType,
    messages: [childUserMessage],
    requestMessages: [childUserMessage],
    conversationId: record.taskId,
    assistantId: parent.assistantId,
    requestContextBuilder: parent.requestContextBuilder,
    mcpManager: parent.mcpManager,
    allowedToolNames: childAllowedToolNames,
    toolPreferences: parent.toolPreferences,
    workspaceScope: parent.workspaceScope,
    allowedSkillNames: parent.allowedSkillNames,
    enableToolDisclosure: parent.enableToolDisclosure,
    reasoningLevel: parent.reasoningLevel,
    requestParams: parent.requestParams,
    abortSignal: abortController.signal,
    systemPromptOverride: SUBAGENT_DEFAULT_SYSTEM_PROMPT,
    toolApprovalConversationId: parent.conversationId,
    runContext: { citationRegistry },
  }

  try {
    await runtime.run(runInput)
    const snapshot = runtime.getSnapshot()
    const finalMessages = snapshot.messages
    const content = extractLastAssistantText(finalMessages)
    const completedAt = Date.now()
    const result: SubagentResult = {
      taskId: record.taskId,
      status: abortController.signal.aborted ? 'aborted' : 'completed',
      content,
      durationMs: completedAt - startedAt,
      toolUseCount: countToolUses(finalMessages),
      usage: extractLastAssistantUsage(finalMessages),
    }

    subagentTaskRegistry.update(record.taskId, {
      status: result.status,
      completedAt,
      result,
    })
  } catch (error) {
    const completedAt = Date.now()
    const status = abortController.signal.aborted ? 'aborted' : 'failed'
    const errorMessage = formatErrorMessageWithCauses(error)
    subagentTaskRegistry.update(record.taskId, {
      status,
      completedAt,
      error: errorMessage,
      result: {
        taskId: record.taskId,
        status,
        content: errorMessage,
        durationMs: completedAt - startedAt,
        toolUseCount: 0,
      },
    })
  }

  const updatedRecord = subagentTaskRegistry.get(record.taskId)
  if (updatedRecord && updatedRecord.status !== 'running') {
    subagentStreamBus.push({
      type: 'task-completed',
      taskId: updatedRecord.taskId,
      conversationId: updatedRecord.conversationId,
      record: updatedRecord,
    })
  }
}

export async function runSubagent(
  params: RunSubagentParams,
): Promise<SubagentAcceptedResult> {
  const { description, prompt, conversationId, source, parent, signal } = params

  if (signal?.aborted) {
    throw new Error('Subagent dispatch was aborted before start.')
  }

  const title = description.trim()
  if (!title) {
    throw new Error('description is required.')
  }
  const taskPrompt = prompt.trim()
  if (!taskPrompt) {
    throw new Error('prompt is required.')
  }

  const taskId = `sub_${uuidv4().replace(/-/g, '').slice(0, 12)}`
  const abortController = new AbortController()
  if (signal) {
    signal.addEventListener('abort', () => abortController.abort(), {
      once: true,
    })
  }

  const record: SubagentTaskRecord = {
    taskId,
    conversationId,
    source,
    title,
    status: 'running',
    createdAt: Date.now(),
    prompt: taskPrompt,
    abortController,
  }

  subagentTaskRegistry.register(record)

  void runChildAgent(record, parent).catch(() => {
    // Errors are persisted on the record; avoid unhandled rejection.
  })

  return {
    accepted: true,
    taskId,
    title,
    status: 'running',
    note:
      'Subagent started asynchronously. The result will arrive as a follow-up background event when the child run completes.',
  }
}

export function abortAllSubagentTasks(): void {
  subagentTaskRegistry.abortAll()
}
