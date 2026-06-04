import { backgroundTaskCompletionBus } from './completion-bus'
import type { BackgroundTaskCompletedEvent } from './completion-bus'

const makeEvent = (): BackgroundTaskCompletedEvent => ({
  kind: 'terminal_command',
  taskId: 'bash_test001',
  conversationId: 'conv-1',
  record: {
    taskId: 'bash_test001',
    conversationId: 'conv-1',
    source: {
      type: 'llm_tool_call',
      assistantMessageId: 'assistant-1',
      toolCallId: 'tool-1',
    },
    title: 'echo done',
    status: 'completed',
    createdAt: 1,
    completedAt: 2,
    stdoutBuffer: 'done',
    stderrBuffer: '',
    exitCode: 0,
    abortController: new AbortController(),
  },
})

describe('backgroundTaskCompletionBus', () => {
  it('notifies subscribers and respects unsubscribe', () => {
    const subscriber = jest.fn()
    const unsubscribe =
      backgroundTaskCompletionBus.subscribeCompleted(subscriber)

    const event = makeEvent()
    backgroundTaskCompletionBus.pushCompleted(event)
    expect(subscriber).toHaveBeenCalledWith(event)

    unsubscribe()
    backgroundTaskCompletionBus.pushCompleted(makeEvent())
    expect(subscriber).toHaveBeenCalledTimes(1)
  })
})
