import { composeAgentInjections } from './agent-injections'
import { TodoItem, todoStore } from './todo-store'

const CONV = 'conv-test'
const BRANCH = 'branch-test'

const item = (content: string): TodoItem => ({
  content,
  activeForm: `Doing ${content}`,
  status: 'pending',
})

beforeEach(() => {
  todoStore.clearAllForConversation(CONV)
})

describe('composeAgentInjections', () => {
  it('returns only base injections when no todos exist', () => {
    const base = [
      {
        type: 'editor-snapshot' as const,
        filePath: '/a.md',
        fileTitle: 'A',
        contextText: '',
        cursorMarker: '|',
      },
    ]
    const result = composeAgentInjections({
      baseInjections: base,
      conversationId: CONV,
    })
    expect(result).toEqual(base)
  })

  it('appends todo-list injection after base injections when todos exist', () => {
    todoStore.set(CONV, BRANCH, [item('Task A')])
    const base = [
      {
        type: 'editor-snapshot' as const,
        filePath: '/a.md',
        fileTitle: 'A',
        contextText: '',
        cursorMarker: '|',
      },
    ]
    const result = composeAgentInjections({
      baseInjections: base,
      conversationId: CONV,
      branchId: BRANCH,
    })
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(base[0])
    expect(result[1]).toEqual({ type: 'todo-list', todos: [item('Task A')] })
  })

  it('does not append todo-list when todos list is empty', () => {
    todoStore.set(CONV, BRANCH, [])
    const result = composeAgentInjections({
      baseInjections: undefined,
      conversationId: CONV,
      branchId: BRANCH,
    })
    expect(result).toHaveLength(0)
  })

  it('handles undefined baseInjections', () => {
    todoStore.set(CONV, BRANCH, [item('Task B')])
    const result = composeAgentInjections({
      baseInjections: undefined,
      conversationId: CONV,
      branchId: BRANCH,
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ type: 'todo-list', todos: [item('Task B')] })
  })

  it('respects branchId isolation', () => {
    todoStore.set(CONV, 'branch-x', [item('X task')])
    const result = composeAgentInjections({
      baseInjections: undefined,
      conversationId: CONV,
      branchId: 'branch-y',
    })
    expect(result).toHaveLength(0)
  })
})
