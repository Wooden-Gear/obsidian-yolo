import type { SubagentTaskRecord } from './types'

export type SubagentStreamEvent = {
  type: 'task-completed'
  taskId: string
  conversationId: string
  record: SubagentTaskRecord
}

type TaskCompletedSubscriber = (event: SubagentStreamEvent) => void

export class SubagentStreamBus {
  private readonly taskCompletedSubscribers = new Set<TaskCompletedSubscriber>()

  subscribeTaskCompleted(fn: TaskCompletedSubscriber): () => void {
    this.taskCompletedSubscribers.add(fn)
    return () => {
      this.taskCompletedSubscribers.delete(fn)
    }
  }

  push(event: SubagentStreamEvent): void {
    for (const fn of this.taskCompletedSubscribers) {
      fn(event)
    }
  }
}

export const subagentStreamBus = new SubagentStreamBus()
