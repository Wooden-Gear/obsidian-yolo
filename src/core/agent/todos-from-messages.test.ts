import type { ChatMessage, ChatToolMessage } from '../../types/chat'
import {
  ToolCallResponse,
  ToolCallResponseStatus,
  createCompleteToolCallArguments,
} from '../../types/tool-call.types'
import { getLocalFileToolServerName } from '../mcp/localFileTools'
import { getToolName } from '../mcp/tool-name-utils'

import { deriveTodosFromMessages } from './todos-from-messages'

const TODO_WRITE_TOOL_NAME = getToolName(
  getLocalFileToolServerName(),
  'todo_write',
)

const SUCCESS_RESPONSE: ToolCallResponse = {
  status: ToolCallResponseStatus.Success,
  data: { type: 'text', text: 'Todos updated.' },
}

const todoWriteToolMessage = (
  todos: unknown,
  id = 'tool-msg',
  response: ToolCallResponse = SUCCESS_RESPONSE,
): ChatToolMessage => ({
  role: 'tool',
  id,
  toolCalls: [
    {
      request: {
        id: `${id}-call`,
        name: TODO_WRITE_TOOL_NAME,
        arguments: createCompleteToolCallArguments({ value: { todos } }),
      },
      response,
    },
  ],
})

const userMessage = (content: string, id = 'u'): ChatMessage => ({
  role: 'user',
  id,
  content: null,
  promptContent: content,
  mentionables: [],
})

describe('deriveTodosFromMessages', () => {
  it('returns empty when no todo_write tool call exists', () => {
    expect(deriveTodosFromMessages([])).toEqual([])
    expect(deriveTodosFromMessages([userMessage('hi')])).toEqual([])
  })

  it('returns todos from the latest todo_write tool call', () => {
    const messages: ChatMessage[] = [
      userMessage('start'),
      todoWriteToolMessage(
        [{ content: 'A', activeForm: 'Doing A', status: 'pending' }],
        'm1',
      ),
      todoWriteToolMessage(
        [
          { content: 'A', activeForm: 'Doing A', status: 'completed' },
          { content: 'B', activeForm: 'Doing B', status: 'in_progress' },
        ],
        'm2',
      ),
    ]
    expect(deriveTodosFromMessages(messages)).toEqual([
      { content: 'A', activeForm: 'Doing A', status: 'completed' },
      { content: 'B', activeForm: 'Doing B', status: 'in_progress' },
    ])
  })

  it('returns empty when the latest todo_write was an empty list (explicit clear)', () => {
    const messages: ChatMessage[] = [
      todoWriteToolMessage(
        [{ content: 'A', activeForm: 'Doing A', status: 'pending' }],
        'm1',
      ),
      todoWriteToolMessage([], 'm2'),
    ]
    expect(deriveTodosFromMessages(messages)).toEqual([])
  })

  it('skips invalid todo entries silently', () => {
    const messages: ChatMessage[] = [
      todoWriteToolMessage(
        [
          { content: 'A', activeForm: 'Doing A', status: 'pending' },
          { content: '', activeForm: 'Bad', status: 'pending' },
          { content: 'B', activeForm: 'Doing B', status: 'unknown' },
          { content: 'C', activeForm: 'Doing C', status: 'completed' },
        ],
        'm1',
      ),
    ]
    expect(deriveTodosFromMessages(messages)).toEqual([
      { content: 'A', activeForm: 'Doing A', status: 'pending' },
      { content: 'C', activeForm: 'Doing C', status: 'completed' },
    ])
  })

  it('returns empty when todos is not an array', () => {
    const messages: ChatMessage[] = [
      todoWriteToolMessage('not-an-array' as unknown as never[], 'm1'),
    ]
    expect(deriveTodosFromMessages(messages)).toEqual([])
  })

  it('ignores non-todo_write tool calls', () => {
    const otherTool: ChatToolMessage = {
      role: 'tool',
      id: 'm1',
      toolCalls: [
        {
          request: {
            id: 'r1',
            name: getToolName(getLocalFileToolServerName(), 'fs_read'),
            arguments: createCompleteToolCallArguments({
              value: { path: 'foo.md' },
            }),
          },
          response: {
            status: ToolCallResponseStatus.Success,
            data: { type: 'text', text: '...' },
          },
        },
      ],
    }
    expect(deriveTodosFromMessages([otherTool])).toEqual([])
  })

  it('skips a failed todo_write and falls back to the previous successful state', () => {
    const messages: ChatMessage[] = [
      todoWriteToolMessage(
        [{ content: 'A', activeForm: 'Doing A', status: 'pending' }],
        'm1',
      ),
      todoWriteToolMessage('not-an-array', 'm2', {
        status: ToolCallResponseStatus.Error,
        error: 'todos must be an array.',
      }),
    ]
    expect(deriveTodosFromMessages(messages)).toEqual([
      { content: 'A', activeForm: 'Doing A', status: 'pending' },
    ])
  })

  it('skips a rejected todo_write and falls back to the previous successful state', () => {
    const messages: ChatMessage[] = [
      todoWriteToolMessage(
        [{ content: 'A', activeForm: 'Doing A', status: 'pending' }],
        'm1',
      ),
      todoWriteToolMessage(
        [{ content: 'B', activeForm: 'Doing B', status: 'pending' }],
        'm2',
        { status: ToolCallResponseStatus.Rejected },
      ),
    ]
    expect(deriveTodosFromMessages(messages)).toEqual([
      { content: 'A', activeForm: 'Doing A', status: 'pending' },
    ])
  })

  it('skips a still-running todo_write so UI never shows un-committed args', () => {
    const messages: ChatMessage[] = [
      todoWriteToolMessage(
        [{ content: 'A', activeForm: 'Doing A', status: 'pending' }],
        'm1',
      ),
      todoWriteToolMessage(
        [{ content: 'B', activeForm: 'Doing B', status: 'in_progress' }],
        'm2',
        { status: ToolCallResponseStatus.Running },
      ),
    ]
    expect(deriveTodosFromMessages(messages)).toEqual([
      { content: 'A', activeForm: 'Doing A', status: 'pending' },
    ])
  })

  it('skips an aborted todo_write and falls back to the previous successful state', () => {
    const messages: ChatMessage[] = [
      todoWriteToolMessage(
        [{ content: 'A', activeForm: 'Doing A', status: 'pending' }],
        'm1',
      ),
      todoWriteToolMessage(
        [{ content: 'B', activeForm: 'Doing B', status: 'pending' }],
        'm2',
        { status: ToolCallResponseStatus.Aborted },
      ),
    ]
    expect(deriveTodosFromMessages(messages)).toEqual([
      { content: 'A', activeForm: 'Doing A', status: 'pending' },
    ])
  })

  it('skips a pending-approval todo_write', () => {
    const messages: ChatMessage[] = [
      todoWriteToolMessage(
        [{ content: 'A', activeForm: 'Doing A', status: 'pending' }],
        'm1',
      ),
      todoWriteToolMessage(
        [{ content: 'B', activeForm: 'Doing B', status: 'pending' }],
        'm2',
        { status: ToolCallResponseStatus.PendingApproval },
      ),
    ]
    expect(deriveTodosFromMessages(messages)).toEqual([
      { content: 'A', activeForm: 'Doing A', status: 'pending' },
    ])
  })

  it('returns empty when the only todo_write call has not succeeded yet', () => {
    const messages: ChatMessage[] = [
      todoWriteToolMessage(
        [{ content: 'A', activeForm: 'Doing A', status: 'pending' }],
        'm1',
        { status: ToolCallResponseStatus.Running },
      ),
    ]
    expect(deriveTodosFromMessages(messages)).toEqual([])
  })

  it('returns frozen array (callers cannot mutate)', () => {
    const messages: ChatMessage[] = [
      todoWriteToolMessage(
        [{ content: 'A', activeForm: 'Doing A', status: 'pending' }],
        'm1',
      ),
    ]
    const result = deriveTodosFromMessages(messages)
    expect(Object.isFrozen(result)).toBe(true)
  })
})
