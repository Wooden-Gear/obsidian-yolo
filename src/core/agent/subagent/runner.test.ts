import { ToolCallResponseStatus } from '../../../types/tool-call.types'
import type { NativeAgentRuntime } from '../native-runtime'

import { autoRejectPendingApprovals } from './runner'

const makeRuntime = (
  toolMessage: {
    role: 'tool'
    toolCalls: Array<{
      request: { id: string; name: string }
      response: { status: ToolCallResponseStatus; error?: string }
    }>
  } | null,
) => {
  const setToolCallResponse = jest.fn()
  return {
    runtime: {
      getSnapshot: jest.fn().mockReturnValue({
        messages: toolMessage ? [toolMessage] : [],
        compaction: [],
        pendingCompactionAnchorMessageId: null,
      }),
      setToolCallResponse,
    } as unknown as NativeAgentRuntime,
    setToolCallResponse,
  }
}

describe('autoRejectPendingApprovals', () => {
  it('rejects only PendingApproval calls and leaves others intact', () => {
    const { runtime, setToolCallResponse } = makeRuntime({
      role: 'tool',
      toolCalls: [
        {
          request: { id: 'pending-1', name: 'tool' },
          response: { status: ToolCallResponseStatus.PendingApproval },
        },
        {
          request: { id: 'running-1', name: 'tool' },
          response: { status: ToolCallResponseStatus.Running },
        },
        {
          request: { id: 'pending-2', name: 'tool' },
          response: { status: ToolCallResponseStatus.PendingApproval },
        },
      ],
    })

    autoRejectPendingApprovals(runtime)

    expect(setToolCallResponse).toHaveBeenCalledTimes(2)
    expect(setToolCallResponse).toHaveBeenCalledWith(
      'pending-1',
      expect.objectContaining({
        status: ToolCallResponseStatus.Error,
        error: expect.stringContaining('5 minutes'),
      }),
    )
    expect(setToolCallResponse).toHaveBeenCalledWith(
      'pending-2',
      expect.any(Object),
    )
    // Running call must not be touched.
    expect(setToolCallResponse).not.toHaveBeenCalledWith(
      'running-1',
      expect.any(Object),
    )
  })

  it('is a no-op when the last message is not a tool message', () => {
    const { runtime, setToolCallResponse } = makeRuntime(null)
    autoRejectPendingApprovals(runtime)
    expect(setToolCallResponse).not.toHaveBeenCalled()
  })

  it('is a no-op when no tool calls are pending', () => {
    const { runtime, setToolCallResponse } = makeRuntime({
      role: 'tool',
      toolCalls: [
        {
          request: { id: 'done-1', name: 'tool' },
          response: { status: ToolCallResponseStatus.Success },
        },
      ],
    })
    autoRejectPendingApprovals(runtime)
    expect(setToolCallResponse).not.toHaveBeenCalled()
  })
})
