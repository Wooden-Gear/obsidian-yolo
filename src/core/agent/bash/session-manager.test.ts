jest.mock('shell-env', () => ({
  shellEnvSync: () => ({
    PATH: '/usr/local/bin:/usr/bin:/bin',
    SHELL: '/bin/bash',
  }),
}))

jest.mock('../external-cli/which', () => ({
  which: jest.fn().mockResolvedValue('/bin/bash'),
}))

import { killAllBashSessions, runBash } from './session-manager'

describe('terminal command session-manager', () => {
  afterEach(() => {
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
})
