jest.mock('shell-env', () => ({
  shellEnvSync: () => ({
    PATH: '/usr/local/bin:/usr/bin:/bin',
    SHELL: '/bin/bash',
  }),
}))

jest.mock('../external-cli/which', () => ({
  which: jest.fn().mockResolvedValue('/bin/bash'),
}))

import { backgroundTaskCompletionBus } from '../background-task/completion-bus'

import { killAllBashSessions, runBash } from './session-manager'

describe('terminal command session-manager', () => {
  afterEach(() => {
    jest.useRealTimers()
    killAllBashSessions()
  })

  it('runs a foreground command and returns its exit code', async () => {
    const result = await runBash({
      command: 'printf hello',
      cwd: '/tmp',
      timeoutSeconds: 2,
    })

    expect(result.state).toBe('completed')
    expect(result.exit_code).toBe(0)
    expect(result.stdout.trim()).toBe('hello')
    expect(result.stderr).toBe('')
  })

  it('separates stdout and stderr for foreground commands', async () => {
    const result = await runBash({
      command: `sh -c 'echo ok; echo err >&2; exit 2'`,
      cwd: '/tmp',
      timeoutSeconds: 2,
    })

    expect(result.state).toBe('completed')
    expect(result.exit_code).toBe(2)
    expect(result.stdout.trim()).toBe('ok')
    expect(result.stderr.trim()).toBe('err')
  })

  it('keeps shell state across shared foreground commands', async () => {
    await runBash({
      command: 'cd /tmp',
      cwd: '/tmp',
      timeoutSeconds: 2,
    })
    const result = await runBash({
      command: 'pwd',
      timeoutSeconds: 2,
    })

    expect(result.state).toBe('completed')
    expect(result.stdout.trim()).toBe('/tmp')
  })

  it('emits a background waiting event with separated output after idle', async () => {
    const subscriber = jest.fn()
    const unsubscribe = backgroundTaskCompletionBus.subscribe(subscriber)

    const resultPromise = runBash({
      command: `sh -c 'echo ready; echo warn >&2; sleep 30'`,
      cwd: '/tmp',
      background: true,
      timeoutSeconds: 60,
      conversationId: 'conv-1',
      source: {
        type: 'llm_tool_call',
        assistantMessageId: 'assistant-1',
        toolCallId: 'tool-1',
      },
    })

    const result = await resultPromise
    expect(result.state).toBe('background')

    await new Promise((resolve) => setTimeout(resolve, 10_500))
    expect(subscriber).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'terminal_command_waiting',
        conversationId: 'conv-1',
        record: expect.objectContaining({
          status: 'running',
          stdoutBuffer: expect.stringContaining('ready'),
          stderrBuffer: expect.stringContaining('warn'),
        }),
      }),
    )

    unsubscribe()
  }, 20_000)
})
