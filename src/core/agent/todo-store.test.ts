import { TodoItem, todoStore } from './todo-store'

const CONV_A = 'conv-a'
const CONV_B = 'conv-b'
const BRANCH_1 = 'branch-1'
const BRANCH_2 = 'branch-2'

const item = (content: string): TodoItem => ({
  content,
  activeForm: `Doing ${content}`,
  status: 'pending',
})

beforeEach(() => {
  todoStore.clearAllForConversation(CONV_A)
  todoStore.clearAllForConversation(CONV_B)
})

describe('TodoStore', () => {
  it('returns null when nothing has been set', () => {
    expect(todoStore.get(CONV_A)).toBeNull()
  })

  it('stores and retrieves todos', () => {
    const todos = [item('Run tests'), item('Lint code')]
    todoStore.set(CONV_A, undefined, todos)
    expect(todoStore.get(CONV_A)).toEqual(todos)
  })

  it('overwrites the entire list on set', () => {
    todoStore.set(CONV_A, undefined, [item('A'), item('B')])
    todoStore.set(CONV_A, undefined, [item('C')])
    expect(todoStore.get(CONV_A)).toEqual([item('C')])
  })

  it('returns a copy — mutation of returned array does not affect store', () => {
    todoStore.set(CONV_A, undefined, [item('A')])
    const result = todoStore.get(CONV_A)!
    result.push(item('B'))
    expect(todoStore.get(CONV_A)).toHaveLength(1)
  })

  it('stores set from a copy — mutation of input array does not affect store', () => {
    const input = [item('A')]
    todoStore.set(CONV_A, undefined, input)
    input.push(item('B'))
    expect(todoStore.get(CONV_A)).toHaveLength(1)
  })

  it('supports explicit empty array to clear todos', () => {
    todoStore.set(CONV_A, undefined, [item('A')])
    todoStore.set(CONV_A, undefined, [])
    expect(todoStore.get(CONV_A)).toEqual([])
  })

  it('isolates branches within the same conversation', () => {
    todoStore.set(CONV_A, BRANCH_1, [item('Branch 1 task')])
    todoStore.set(CONV_A, BRANCH_2, [item('Branch 2 task')])
    expect(todoStore.get(CONV_A, BRANCH_1)).toEqual([item('Branch 1 task')])
    expect(todoStore.get(CONV_A, BRANCH_2)).toEqual([item('Branch 2 task')])
  })

  it('treats undefined branchId and default branch as the same key', () => {
    todoStore.set(CONV_A, undefined, [item('Task')])
    expect(todoStore.get(CONV_A, undefined)).toEqual([item('Task')])
  })

  it('isolates different conversations', () => {
    todoStore.set(CONV_A, undefined, [item('A task')])
    expect(todoStore.get(CONV_B)).toBeNull()
  })

  it('clear removes a specific branch', () => {
    todoStore.set(CONV_A, BRANCH_1, [item('T')])
    todoStore.set(CONV_A, BRANCH_2, [item('U')])
    todoStore.clear(CONV_A, BRANCH_1)
    expect(todoStore.get(CONV_A, BRANCH_1)).toBeNull()
    expect(todoStore.get(CONV_A, BRANCH_2)).toEqual([item('U')])
  })

  it('clearAllForConversation removes all branches for that conversation', () => {
    todoStore.set(CONV_A, BRANCH_1, [item('T')])
    todoStore.set(CONV_A, BRANCH_2, [item('U')])
    todoStore.set(CONV_B, BRANCH_1, [item('V')])
    todoStore.clearAllForConversation(CONV_A)
    expect(todoStore.get(CONV_A, BRANCH_1)).toBeNull()
    expect(todoStore.get(CONV_A, BRANCH_2)).toBeNull()
    expect(todoStore.get(CONV_B, BRANCH_1)).toEqual([item('V')])
  })
})
