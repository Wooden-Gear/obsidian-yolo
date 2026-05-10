import { DEFAULT_BRANCH_ID } from './branch'

export type TodoStatus = 'pending' | 'in_progress' | 'completed'

export type TodoItem = {
  content: string
  activeForm: string
  status: TodoStatus
}

class TodoStore {
  private readonly map = new Map<string, TodoItem[]>()

  private makeKey(conversationId: string, branchId?: string): string {
    return `${conversationId}::${branchId ?? DEFAULT_BRANCH_ID}`
  }

  get(conversationId: string, branchId?: string): TodoItem[] | null {
    const items = this.map.get(this.makeKey(conversationId, branchId))
    if (items === undefined) {
      return null
    }
    return [...items]
  }

  set(
    conversationId: string,
    branchId: string | undefined,
    todos: TodoItem[],
  ): void {
    this.map.set(this.makeKey(conversationId, branchId), [...todos])
  }

  clear(conversationId: string, branchId?: string): void {
    this.map.delete(this.makeKey(conversationId, branchId))
  }

  clearAllForConversation(conversationId: string): void {
    const prefix = `${conversationId}::`
    for (const key of this.map.keys()) {
      if (key.startsWith(prefix)) {
        this.map.delete(key)
      }
    }
  }
}

export const todoStore = new TodoStore()
