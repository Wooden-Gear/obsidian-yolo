import { TodoItem } from '../../../core/agent/todo-store'

import { renderTodoListInjection } from './todoListContext'

const pending = (content: string, activeForm: string): TodoItem => ({
  content,
  activeForm,
  status: 'pending',
})

const inProgress = (content: string, activeForm: string): TodoItem => ({
  content,
  activeForm,
  status: 'in_progress',
})

const completed = (content: string, activeForm: string): TodoItem => ({
  content,
  activeForm,
  status: 'completed',
})

describe('renderTodoListInjection', () => {
  it('renders in_progress items using activeForm', () => {
    const result = renderTodoListInjection({
      type: 'todo-list',
      todos: [inProgress('Run tests', 'Running tests')],
    })
    expect(result.content).toContain('[in_progress] Running tests')
    expect(result.content).not.toContain('Run tests')
  })

  it('renders pending items using content', () => {
    const result = renderTodoListInjection({
      type: 'todo-list',
      todos: [pending('Run tests', 'Running tests')],
    })
    expect(result.content).toContain('[pending] Run tests')
    expect(result.content).not.toContain('Running tests')
  })

  it('renders completed items using content', () => {
    const result = renderTodoListInjection({
      type: 'todo-list',
      todos: [completed('Run tests', 'Running tests')],
    })
    expect(result.content).toContain('[completed] Run tests')
  })

  it('preserves original ordering', () => {
    const result = renderTodoListInjection({
      type: 'todo-list',
      todos: [
        inProgress('A', 'Doing A'),
        completed('B', 'Done B'),
        pending('C', 'Doing C'),
      ],
    })
    const text = result.content as string
    const posA = text.indexOf('[in_progress] Doing A')
    const posB = text.indexOf('[completed] B')
    const posC = text.indexOf('[pending] C')
    expect(posA).toBeLessThan(posB)
    expect(posB).toBeLessThan(posC)
  })

  it('wraps output in <current-todo-list> tags', () => {
    const result = renderTodoListInjection({
      type: 'todo-list',
      todos: [pending('A', 'Doing A')],
    })
    const text = result.content as string
    expect(text.startsWith('<current-todo-list>')).toBe(true)
    expect(text.endsWith('</current-todo-list>')).toBe(true)
  })

  it('returns a user-role message', () => {
    const result = renderTodoListInjection({
      type: 'todo-list',
      todos: [pending('A', 'Doing A')],
    })
    expect(result.role).toBe('user')
  })
})
