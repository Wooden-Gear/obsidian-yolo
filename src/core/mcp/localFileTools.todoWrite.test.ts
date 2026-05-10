import { App } from 'obsidian'

import { ToolCallResponseStatus } from '../../types/tool-call.types'
import { todoStore } from '../agent/todo-store'

import { callLocalFileTool } from './localFileTools'

const stubApp = {} as unknown as App

const call = (
  args: Record<string, unknown>,
  opts?: { conversationId?: string; branchId?: string },
) =>
  callLocalFileTool({
    app: stubApp,
    toolName: 'todo_write',
    args,
    conversationId: opts?.conversationId ?? 'conv-1',
    branchId: opts?.branchId,
  })

describe('todo_write tool', () => {
  beforeEach(() => {
    todoStore.clearAllForConversation('conv-1')
    todoStore.clearAllForConversation('conv-2')
  })

  it('writes a valid todo list and returns success', async () => {
    const result = await call({
      todos: [
        {
          content: 'Run tests',
          activeForm: 'Running tests',
          status: 'pending',
        },
        {
          content: 'Build project',
          activeForm: 'Building project',
          status: 'in_progress',
        },
      ],
    })

    expect(result.status).toBe(ToolCallResponseStatus.Success)
    expect(todoStore.get('conv-1')).toEqual([
      { content: 'Run tests', activeForm: 'Running tests', status: 'pending' },
      {
        content: 'Build project',
        activeForm: 'Building project',
        status: 'in_progress',
      },
    ])
  })

  it('overwrites the previous list (no merge)', async () => {
    await call({
      todos: [
        { content: 'A', activeForm: 'Doing A', status: 'in_progress' },
        { content: 'B', activeForm: 'Doing B', status: 'pending' },
      ],
    })

    await call({
      todos: [
        { content: 'A', activeForm: 'Doing A', status: 'completed' },
        { content: 'B', activeForm: 'Doing B', status: 'in_progress' },
      ],
    })

    expect(todoStore.get('conv-1')).toEqual([
      { content: 'A', activeForm: 'Doing A', status: 'completed' },
      { content: 'B', activeForm: 'Doing B', status: 'in_progress' },
    ])
  })

  it('clears the list when an empty array is passed', async () => {
    await call({
      todos: [{ content: 'A', activeForm: 'Doing A', status: 'pending' }],
    })

    const result = await call({ todos: [] })

    expect(result.status).toBe(ToolCallResponseStatus.Success)
    expect(todoStore.get('conv-1')).toEqual([])
  })

  it('does NOT auto-clear when all items are completed', async () => {
    const result = await call({
      todos: [
        { content: 'A', activeForm: 'Doing A', status: 'completed' },
        { content: 'B', activeForm: 'Doing B', status: 'completed' },
      ],
    })

    expect(result.status).toBe(ToolCallResponseStatus.Success)
    expect(todoStore.get('conv-1')).toHaveLength(2)
  })

  it('errors when conversationId is missing', async () => {
    const result = await callLocalFileTool({
      app: stubApp,
      toolName: 'todo_write',
      args: { todos: [] },
    })

    expect(result.status).toBe(ToolCallResponseStatus.Error)
  })

  it('errors when todos is not an array', async () => {
    const result = await call({ todos: 'not-an-array' })

    expect(result.status).toBe(ToolCallResponseStatus.Error)
    if (result.status !== ToolCallResponseStatus.Error) return
    expect(result.error).toMatch(/todos must be an array/)
  })

  it('errors when content is empty', async () => {
    const result = await call({
      todos: [{ content: '   ', activeForm: 'Doing A', status: 'pending' }],
    })

    expect(result.status).toBe(ToolCallResponseStatus.Error)
    if (result.status !== ToolCallResponseStatus.Error) return
    expect(result.error).toMatch(/content/)
  })

  it('errors when activeForm is empty', async () => {
    const result = await call({
      todos: [{ content: 'A', activeForm: '', status: 'pending' }],
    })

    expect(result.status).toBe(ToolCallResponseStatus.Error)
    if (result.status !== ToolCallResponseStatus.Error) return
    expect(result.error).toMatch(/activeForm/)
  })

  it('errors when status is invalid', async () => {
    const result = await call({
      todos: [{ content: 'A', activeForm: 'Doing A', status: 'done' }],
    })

    expect(result.status).toBe(ToolCallResponseStatus.Error)
    if (result.status !== ToolCallResponseStatus.Error) return
    expect(result.error).toMatch(/status/)
  })

  it('errors when more than one item is in_progress', async () => {
    const result = await call({
      todos: [
        { content: 'A', activeForm: 'Doing A', status: 'in_progress' },
        { content: 'B', activeForm: 'Doing B', status: 'in_progress' },
      ],
    })

    expect(result.status).toBe(ToolCallResponseStatus.Error)
    if (result.status !== ToolCallResponseStatus.Error) return
    expect(result.error).toMatch(/in_progress/)
  })

  it('isolates state by conversationId and branchId', async () => {
    await call(
      { todos: [{ content: 'A', activeForm: 'Doing A', status: 'pending' }] },
      { conversationId: 'conv-1' },
    )
    await call(
      { todos: [{ content: 'B', activeForm: 'Doing B', status: 'pending' }] },
      { conversationId: 'conv-2' },
    )
    await call(
      {
        todos: [{ content: 'C', activeForm: 'Doing C', status: 'pending' }],
      },
      { conversationId: 'conv-1', branchId: 'branch-x' },
    )

    expect(todoStore.get('conv-1')?.[0]?.content).toBe('A')
    expect(todoStore.get('conv-2')?.[0]?.content).toBe('B')
    expect(todoStore.get('conv-1', 'branch-x')?.[0]?.content).toBe('C')
  })

  it('uses the same default branch sentinel as the agent service run key', async () => {
    await call(
      { todos: [{ content: 'A', activeForm: 'Doing A', status: 'pending' }] },
      { conversationId: 'conv-1' },
    )

    const { DEFAULT_BRANCH_ID } = await import('../agent/branch')
    expect(todoStore.get('conv-1', DEFAULT_BRANCH_ID)?.[0]?.content).toBe('A')
  })
})
