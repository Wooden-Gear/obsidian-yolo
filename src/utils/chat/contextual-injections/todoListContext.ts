import type { RequestMessage } from '../../../types/llm/request'

import type { TodoListInjection } from './types'

export function renderTodoListInjection(
  injection: TodoListInjection,
): RequestMessage {
  const lines = injection.todos.map((item) => {
    const label = `[${item.status}]`
    const text = item.status === 'in_progress' ? item.activeForm : item.content
    return `- ${label} ${text}`
  })

  const content = `<current-todo-list>\n${lines.join('\n')}\n</current-todo-list>`

  return {
    role: 'user',
    content,
  }
}
