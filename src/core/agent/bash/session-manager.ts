// Desktop-only terminal command session manager. Imported lazily by bash/index.ts.
/* eslint-disable import/no-nodejs-modules -- desktop-only module, lazy-loaded behind Platform.isDesktop */
import { spawn } from 'node:child_process'
import type {
  ChildProcessWithoutNullStreams,
  SpawnOptions,
} from 'node:child_process'
import { stat } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { StringDecoder } from 'node:string_decoder'
/* eslint-enable import/no-nodejs-modules */

import { spawn as crossSpawn } from 'cross-spawn'
import { v4 as uuidv4 } from 'uuid'

import type { TaskSource } from '../../../types/chat'
import { backgroundTaskCompletionBus } from '../background-task/completion-bus'
import type { BashTaskRecord } from './types'
import type { ShellProvider } from './shell-provider'
import { resolveShellProvider } from './shell-provider'

const MAX_OUTPUT_BYTES = 1 * 1024 * 1024
const TRUNCATE_HEAD_BYTES = 256 * 1024
const TRUNCATE_TAIL_BYTES = 256 * 1024
const SIGKILL_DELAY_MS = 3000
const DEFAULT_TIMEOUT_MS = 120_000
const MAX_TIMEOUT_MS = 10 * 60_000
const BACKGROUND_INITIAL_WAIT_MS = 2_000
const IDLE_WAIT_MS = 10_000
const SESSION_IDLE_TTL_MS = 5 * 60_000

export type RunBashParams = {
  command?: string
  sessionId?: number
  input?: string
  background?: boolean
  cwd?: string
  timeoutSeconds?: number
  kill?: boolean
  signal?: AbortSignal
  conversationId?: string
  source?: TaskSource
}

export type RunBashResult = {
  session_id?: number
  state:
    | 'completed'
    | 'running'
    | 'waiting'
    | 'background'
    | 'timeout'
    | 'killed'
  stdout: string
  exit_code?: number | null
  truncated?: {
    totalBytes: number
    omittedBytes: number
  }
}

type ActiveCommand = {
  token: string
  collector: CappedOutputCollector
  lastOutputAt: number
  exitCode?: number | null
  doneAt?: number
  backgroundRecord?: BashTaskRecord
  backgroundCompletedEmitted?: boolean
}

type BashSession = {
  id: number
  provider: ShellProvider
  child: ChildProcessWithoutNullStreams
  decoder: StringDecoder
  lineBuffer: string
  activeCommand: ActiveCommand | null
  lastUsedAt: number
  killProcess: () => void
  cancelPendingKill: () => void
  waiters: Set<() => void>
}

const sessions = new Map<number, BashSession>()
let sharedSessionId: number | null = null
let nextSessionId = 1

class CappedOutputCollector {
  private fullChunks: Buffer[] = []
  private headChunks: Buffer[] = []
  private tailChunks: Buffer[] = []
  private tailBytes = 0
  private capped = false
  totalBytes = 0

  pushText(text: string): void {
    if (!text) return
    this.push(Buffer.from(text, 'utf8'))
  }

  private push(chunk: Buffer): void {
    this.totalBytes += chunk.length

    if (!this.capped) {
      if (this.totalBytes <= MAX_OUTPUT_BYTES) {
        this.fullChunks.push(chunk)
        return
      }
      this.capped = true
      const allSoFar = Buffer.concat([...this.fullChunks, chunk])
      this.fullChunks = []
      this.headChunks.push(allSoFar.subarray(0, TRUNCATE_HEAD_BYTES))
      if (allSoFar.length > TRUNCATE_HEAD_BYTES) {
        const leftover = allSoFar.subarray(TRUNCATE_HEAD_BYTES)
        this.tailChunks.push(leftover)
        this.tailBytes = leftover.length
        this.trimTail()
      }
      return
    }

    this.tailChunks.push(chunk)
    this.tailBytes += chunk.length
    this.trimTail()
  }

  private trimTail(): void {
    while (this.tailBytes > TRUNCATE_TAIL_BYTES && this.tailChunks.length > 0) {
      const front = this.tailChunks[0]
      if (this.tailBytes - front.length >= TRUNCATE_TAIL_BYTES) {
        this.tailBytes -= front.length
        this.tailChunks.shift()
      } else {
        const keep = TRUNCATE_TAIL_BYTES - (this.tailBytes - front.length)
        this.tailChunks[0] = front.subarray(front.length - keep)
        this.tailBytes = TRUNCATE_TAIL_BYTES
        break
      }
    }
  }

  finalize(extraText = ''): {
    text: string
    truncated?: { totalBytes: number; omittedBytes: number }
  } {
    if (!this.capped) {
      return {
        text: Buffer.concat(this.fullChunks).toString('utf8') + extraText,
      }
    }

    const headBuf = Buffer.concat(this.headChunks).subarray(
      0,
      TRUNCATE_HEAD_BYTES,
    )
    const tailBuf = Buffer.concat(this.tailChunks).subarray(
      -TRUNCATE_TAIL_BYTES,
    )
    const omittedBytes = Math.max(
      0,
      this.totalBytes - headBuf.length - tailBuf.length,
    )
    const marker = `\n\n... [输出过长，中间 ${omittedBytes} 字节已省略] ...\n\n`
    return {
      text:
        headBuf.toString('utf8') +
        marker +
        tailBuf.toString('utf8') +
        extraText,
      truncated: { totalBytes: this.totalBytes, omittedBytes },
    }
  }
}

const createKillProcess = (child: ChildProcessWithoutNullStreams) => {
  let killed = false
  let killTimer: ReturnType<typeof setTimeout> | null = null

  const cancelPendingKill = () => {
    if (killTimer) {
      clearTimeout(killTimer)
      killTimer = null
    }
  }

  const killProcess = () => {
    if (killed) return
    killed = true
    if (child.pid === undefined) return

    if (process.platform === 'win32') {
      const fallbackKill = () => {
        try {
          child.kill()
        } catch {
          // process already exited
        }
      }
      try {
        const tk = spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], {
          windowsHide: true,
          stdio: 'ignore',
        })
        tk.once('error', fallbackKill)
        tk.once('close', (code) => {
          if (code !== 0) fallbackKill()
        })
      } catch {
        fallbackKill()
      }
      return
    }

    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch {
      // process already exited
    }
    killTimer = setTimeout(() => {
      if (child.pid === undefined) return
      try {
        process.kill(-child.pid, 'SIGKILL')
      } catch {
        // process already exited
      }
    }, SIGKILL_DELAY_MS)
    killTimer.unref?.()
  }

  return { killProcess, cancelPendingKill }
}

const notifyWaiters = (session: BashSession): void => {
  for (const waiter of session.waiters) waiter()
  session.waiters.clear()
}

const createBashTaskRecord = ({
  command,
  conversationId,
  source,
  signal,
}: {
  command: string
  conversationId: string
  source: TaskSource
  signal?: AbortSignal
}): BashTaskRecord => {
  const abortController = new AbortController()
  signal?.addEventListener('abort', () => abortController.abort(), {
    once: true,
  })
  return {
    taskId: `bash_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
    conversationId,
    source,
    title: command.slice(0, 80),
    status: 'running',
    createdAt: Date.now(),
    stdoutBuffer: '',
    stderrBuffer: '',
    exitCode: null,
    abortController,
  }
}

const emitBackgroundCommandCompleted = (session: BashSession): void => {
  const active = session.activeCommand
  if (
    !active?.backgroundRecord ||
    active.backgroundCompletedEmitted ||
    active.exitCode === undefined
  ) {
    return
  }

  active.backgroundCompletedEmitted = true
  const completedAt = Date.now()
  const snapshot = active.collector.finalize(session.lineBuffer)
  const status = active.backgroundRecord.abortController.signal.aborted
    ? 'cancelled'
    : active.exitCode === 0
      ? 'completed'
      : 'failed'
  const updatedRecord: BashTaskRecord = {
    ...active.backgroundRecord,
    status,
    completedAt,
    stdoutBuffer: snapshot.text,
    stderrBuffer: '',
    exitCode: active.exitCode ?? null,
  }

  backgroundTaskCompletionBus.pushCompleted({
    kind: 'terminal_command',
    taskId: updatedRecord.taskId,
    conversationId: updatedRecord.conversationId,
    record: updatedRecord,
  })

  session.activeCommand = null
  session.lineBuffer = ''
  session.lastUsedAt = Date.now()
}

const writeToSession = (session: BashSession, text: string): void => {
  session.child.stdin.write(text, 'utf8')
}

const handleSessionText = (session: BashSession, text: string): void => {
  if (!text) return
  const active = session.activeCommand
  if (active) {
    active.lastOutputAt = Date.now()
  }

  session.lineBuffer += text
  while (true) {
    const newlineIndex = session.lineBuffer.search(/\r?\n/)
    if (newlineIndex === -1) break

    const lineEnd =
      session.lineBuffer[newlineIndex] === '\r' &&
      session.lineBuffer[newlineIndex + 1] === '\n'
        ? newlineIndex + 2
        : newlineIndex + 1
    const line = session.lineBuffer.slice(0, lineEnd)
    session.lineBuffer = session.lineBuffer.slice(lineEnd)

    const marker = session.provider.parseDoneMarker(line)
    if (active && marker && marker.token === active.token) {
      active.exitCode = marker.exitCode
      active.doneAt = Date.now()
      emitBackgroundCommandCompleted(session)
      notifyWaiters(session)
      continue
    }

    active?.collector.pushText(line)
  }

  notifyWaiters(session)
}

const makeToken = (): string => {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

const assertDirectory = async (cwd: string): Promise<void> => {
  if (!isAbsolute(cwd)) {
    throw new Error(`cwd must be an absolute path: ${cwd}`)
  }
  const stats = await stat(cwd)
  if (!stats.isDirectory()) {
    throw new Error(`cwd is not a directory: ${cwd}`)
  }
}

const cleanupIdleSessions = (): void => {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (id === sharedSessionId) continue
    if (session.activeCommand) continue
    if (now - session.lastUsedAt < SESSION_IDLE_TTL_MS) continue
    session.killProcess()
    sessions.delete(id)
  }
}

const createSession = async (cwd?: string): Promise<BashSession> => {
  const provider = await resolveShellProvider()
  const spawnOptions: SpawnOptions =
    process.platform === 'win32'
      ? {
          cwd,
          env: provider.env,
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      : {
          cwd,
          env: provider.env,
          detached: true,
          stdio: ['pipe', 'pipe', 'pipe'],
        }

  const spawnFn = process.platform === 'win32' ? crossSpawn : spawn
  const child = spawnFn(
    provider.binary,
    provider.spawnArgs,
    spawnOptions,
  ) as ChildProcessWithoutNullStreams
  const { killProcess, cancelPendingKill } = createKillProcess(child)

  const session: BashSession = {
    id: nextSessionId++,
    provider,
    child,
    decoder: new StringDecoder('utf8'),
    lineBuffer: '',
    activeCommand: null,
    lastUsedAt: Date.now(),
    killProcess,
    cancelPendingKill,
    waiters: new Set(),
  }

  child.stdout.on('data', (chunk: Buffer) => {
    handleSessionText(session, session.decoder.write(chunk))
  })
  child.stderr.on('data', (chunk: Buffer) => {
    handleSessionText(session, chunk.toString('utf8'))
  })
  child.stdin.on('error', () => {
    // close/error events surface the failure; stdin errors can happen after kill.
  })
  child.once('error', (error) => {
    const active = session.activeCommand
    if (active && active.exitCode === undefined) {
      active.collector.pushText(`\nShell process error: ${error.message}`)
      active.exitCode = null
      active.doneAt = Date.now()
    }
    notifyWaiters(session)
  })
  child.once('close', (code) => {
    handleSessionText(session, session.decoder.end())
    session.cancelPendingKill()
    sessions.delete(session.id)
    if (sharedSessionId === session.id) sharedSessionId = null
    const active = session.activeCommand
    if (active && active.exitCode === undefined) {
      active.exitCode = code
      active.doneAt = Date.now()
    }
    emitBackgroundCommandCompleted(session)
    notifyWaiters(session)
  })

  sessions.set(session.id, session)
  if (provider.sessionInitScript) {
    writeToSession(session, provider.sessionInitScript + provider.lineEnding)
  }
  return session
}

const getSharedSession = async (cwd?: string): Promise<BashSession> => {
  if (sharedSessionId) {
    const existing = sessions.get(sharedSessionId)
    if (existing) return existing
  }
  const session = await createSession(cwd)
  sharedSessionId = session.id
  return session
}

const waitForChange = (
  session: BashSession,
  signal?: AbortSignal,
): Promise<void> => {
  if (signal?.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    let timeout: ReturnType<typeof setTimeout> | null = null
    const done = () => {
      if (timeout) clearTimeout(timeout)
      session.waiters.delete(done)
      signal?.removeEventListener('abort', done)
      resolve()
    }
    session.waiters.add(done)
    signal?.addEventListener('abort', done, { once: true })
    timeout = setTimeout(done, 50)
  })
}

const buildResult = (
  session: BashSession,
  state: RunBashResult['state'],
): RunBashResult => {
  const active = session.activeCommand
  if (!active) {
    return {
      session_id: session.id,
      state,
      stdout: '',
    }
  }

  const snapshot = active.collector.finalize(session.lineBuffer)
  return {
    session_id: session.id,
    state,
    stdout: snapshot.text,
    ...(active.exitCode !== undefined ? { exit_code: active.exitCode } : {}),
    ...(snapshot.truncated ? { truncated: snapshot.truncated } : {}),
  }
}

const waitForCommandState = async ({
  session,
  background,
  timeoutMs,
  signal,
  backgroundRecordFactory,
}: {
  session: BashSession
  background: boolean
  timeoutMs: number
  signal?: AbortSignal
  backgroundRecordFactory?: () => BashTaskRecord
}): Promise<RunBashResult> => {
  const startedAt = Date.now()
  while (true) {
    const active = session.activeCommand
    if (!active) {
      return buildResult(session, 'completed')
    }

    if (signal?.aborted) {
      session.killProcess()
      return buildResult(session, 'killed')
    }

    if (active.exitCode !== undefined) {
      const result = buildResult(session, 'completed')
      session.activeCommand = null
      session.lineBuffer = ''
      session.lastUsedAt = Date.now()
      return result
    }

    const now = Date.now()
    if (background && now - startedAt >= BACKGROUND_INITIAL_WAIT_MS) {
      if (backgroundRecordFactory && !active.backgroundRecord) {
        active.backgroundRecord = backgroundRecordFactory()
      }
      return buildResult(session, 'background')
    }
    if (!background && now - active.lastOutputAt >= IDLE_WAIT_MS) {
      return buildResult(session, 'waiting')
    }
    if (!background && now - startedAt >= timeoutMs) {
      return buildResult(session, 'timeout')
    }

    await waitForChange(session, signal)
  }
}

const resolveTimeoutMs = (timeoutSeconds?: number): number => {
  if (timeoutSeconds === undefined) return DEFAULT_TIMEOUT_MS
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new Error('timeout must be a positive number of seconds.')
  }
  return Math.min(Math.floor(timeoutSeconds * 1000), MAX_TIMEOUT_MS)
}

export async function runBash(params: RunBashParams): Promise<RunBashResult> {
  cleanupIdleSessions()

  if (params.signal?.aborted) {
    return {
      state: 'killed',
      stdout: '',
    }
  }

  if (params.cwd) {
    await assertDirectory(params.cwd)
  }

  const timeoutMs = resolveTimeoutMs(params.timeoutSeconds)
  const session =
    params.sessionId !== undefined
      ? sessions.get(params.sessionId)
      : params.background
        ? await createSession(params.cwd)
        : await getSharedSession(params.cwd)

  if (!session) {
    throw new Error(`Unknown terminal command session_id: ${params.sessionId}`)
  }

  session.lastUsedAt = Date.now()

  if (params.kill) {
    session.activeCommand?.backgroundRecord?.abortController.abort()
    session.killProcess()
    sessions.delete(session.id)
    if (sharedSessionId === session.id) sharedSessionId = null
    return buildResult(session, 'killed')
  }

  if (params.input) {
    writeToSession(session, params.input)
  }

  const command = params.command?.trim()
  if (command) {
    if (session.activeCommand && session.activeCommand.exitCode === undefined) {
      throw new Error(
        `Session ${session.id} is already running a command. Poll it, send input, or kill it before starting another command.`,
      )
    }
    const token = makeToken()
    session.activeCommand = {
      token,
      collector: new CappedOutputCollector(),
      lastOutputAt: Date.now(),
    }
    session.lineBuffer = ''
    writeToSession(
      session,
      session.provider.wrapCommand({
        command,
        token,
        cwd: params.cwd,
      }) + session.provider.lineEnding,
    )
  }

  if (!session.activeCommand) {
    return {
      session_id: session.id,
      state: 'running',
      stdout: '',
    }
  }

  const backgroundCommand =
    params.background === true && command ? command : undefined

  return waitForCommandState({
    session,
    background: params.background === true,
    timeoutMs,
    signal: params.signal,
    backgroundRecordFactory:
      backgroundCommand && params.conversationId && params.source
        ? () =>
            createBashTaskRecord({
              command: backgroundCommand,
              conversationId: params.conversationId!,
              source: params.source!,
              signal: params.signal,
            })
        : undefined,
  })
}

export function killAllBashSessions(): void {
  for (const session of sessions.values()) {
    try {
      session.killProcess()
    } catch {
      // best-effort cleanup
    }
  }
  sessions.clear()
  sharedSessionId = null
}
