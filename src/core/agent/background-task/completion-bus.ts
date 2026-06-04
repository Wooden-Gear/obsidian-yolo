import type { BashTaskRecord } from '../bash/types'
import type { AsyncTaskRecord } from '../external-cli/async-task-registry'
import type { SubagentTaskRecord } from '../subagent/types'

export type BackgroundTaskCompletedEvent =
  | {
      kind: 'external_agent'
      taskId: string
      conversationId: string
      record: AsyncTaskRecord
    }
  | {
      kind: 'subagent'
      taskId: string
      conversationId: string
      record: SubagentTaskRecord
    }
  | {
      kind: 'terminal_command'
      taskId: string
      conversationId: string
      record: BashTaskRecord
    }

type BackgroundTaskCompletedSubscriber = (
  event: BackgroundTaskCompletedEvent,
) => void

class BackgroundTaskCompletionBus {
  private readonly subscribers = new Set<BackgroundTaskCompletedSubscriber>()

  subscribeCompleted(fn: BackgroundTaskCompletedSubscriber): () => void {
    this.subscribers.add(fn)
    return () => {
      this.subscribers.delete(fn)
    }
  }

  pushCompleted(event: BackgroundTaskCompletedEvent): void {
    for (const fn of this.subscribers) {
      fn(event)
    }
  }
}

export const backgroundTaskCompletionBus =
  new BackgroundTaskCompletionBus()
