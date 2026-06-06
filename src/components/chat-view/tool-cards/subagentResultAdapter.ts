import { getLocalFileToolServerName } from '../../../core/mcp/localFileTools'
import { getToolName } from '../../../core/mcp/tool-name-utils'
import type {
  ChatSubagentResultMessage,
  ChatToolMessage,
} from '../../../types/chat'
import {
  type ToolCallRequest,
  type ToolCallResponse,
  ToolCallResponseStatus,
} from '../../../types/tool-call.types'

export function buildSynthToolMessageFromSubagentResult(
  message: ChatSubagentResultMessage,
): ChatToolMessage {
  return {
    role: 'tool',
    id: message.id,
    toolCalls: [
      {
        request: buildSynthRequest(message),
        response: buildSynthResponse(message),
      },
    ],
  }
}

function buildSynthRequest(
  message: ChatSubagentResultMessage,
): ToolCallRequest {
  return {
    id: `result-${message.taskId}`,
    name: getToolName(getLocalFileToolServerName(), 'delegate_subagent'),
    arguments: {
      kind: 'complete',
      value: {
        description: message.title,
        prompt: message.title,
        stderr: message.activityLog ?? '',
        stdout: message.content,
      },
    },
  }
}

function buildSynthResponse(
  message: ChatSubagentResultMessage,
): ToolCallResponse {
  const text = message.content || message.status

  switch (message.status) {
    case 'completed':
      return {
        status: ToolCallResponseStatus.Success,
        data: { type: 'text', text },
      }
    case 'aborted':
      return {
        status: ToolCallResponseStatus.Aborted,
        data: text ? { type: 'text', text } : undefined,
      }
    case 'failed':
    default:
      return {
        status: ToolCallResponseStatus.Error,
        error: text || 'Subagent task failed.',
      }
  }
}
