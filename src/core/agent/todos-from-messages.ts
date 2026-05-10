import type { ChatMessage } from '../../types/chat'
import {
  ToolCallResponseStatus,
  getToolCallArgumentsObject,
} from '../../types/tool-call.types'
import { parseToolName } from '../mcp/tool-name-utils'

export type TodoStatus = 'pending' | 'in_progress' | 'completed'

export type TodoItem = {
  content: string
  activeForm: string
  status: TodoStatus
}

const EMPTY: ReadonlyArray<TodoItem> = Object.freeze([])

/**
 * Derive the current todo list from the conversation message stream.
 *
 * The source of truth is the latest `todo_write` tool call in the (already
 * branch-filtered) message list — its `arguments.todos` is the live state.
 * No in-memory caching layer is needed: the conversation persistence layer
 * already stores tool call arguments, so this derivation works across
 * Obsidian restarts and naturally respects branches.
 */
export function deriveTodosFromMessages(
  messages: ReadonlyArray<ChatMessage>,
): ReadonlyArray<TodoItem> {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.role !== 'tool') continue
    for (let j = message.toolCalls.length - 1; j >= 0; j--) {
      const { request, response } = message.toolCalls[j]
      if (!isTodoWriteToolName(request.name)) continue
      // Only successful todo_write calls update the live state. Skip pending,
      // running, rejected, errored, or aborted calls and keep walking back to
      // the previous successful one — a failed write must not overwrite the
      // last good state.
      if (response.status !== ToolCallResponseStatus.Success) continue
      const argsObject = getToolCallArgumentsObject(request.arguments)
      if (!argsObject) return EMPTY
      return parseTodos(argsObject.todos)
    }
  }
  return EMPTY
}

function isTodoWriteToolName(name: string): boolean {
  try {
    return parseToolName(name).toolName === 'todo_write'
  } catch {
    return false
  }
}

function parseTodos(value: unknown): ReadonlyArray<TodoItem> {
  if (!Array.isArray(value)) return EMPTY
  const result: TodoItem[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const content = record.content
    const activeForm = record.activeForm
    const status = record.status
    if (typeof content !== 'string' || content.trim() === '') continue
    if (typeof activeForm !== 'string' || activeForm.trim() === '') continue
    if (
      status !== 'pending' &&
      status !== 'in_progress' &&
      status !== 'completed'
    ) {
      continue
    }
    result.push({ content, activeForm, status })
  }
  return Object.freeze(result)
}
