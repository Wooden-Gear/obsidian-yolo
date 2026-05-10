import type { ContextualInjection } from '../../utils/chat/contextual-injections'

import { todoStore } from './todo-store'

export function composeAgentInjections(args: {
  baseInjections: ContextualInjection[] | undefined
  conversationId: string
  branchId?: string
}): ContextualInjection[] {
  const todos = todoStore.get(args.conversationId, args.branchId) ?? []
  return [
    ...(args.baseInjections ?? []),
    ...(todos.length > 0 ? [{ type: 'todo-list' as const, todos }] : []),
  ]
}
