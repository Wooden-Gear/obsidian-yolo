import { App, FileSystemAdapter, MarkdownView, TFile } from 'obsidian'

import { McpTool } from '../../types/mcp.types'
import { ToolCallResponseStatus } from '../../types/tool-call.types'
import { collectWikilinkPaths } from '../../utils/llm/annotate-wikilinks'

export const JS_SANDBOX_TOOL_NAME = 'js_eval'

const SANDBOX_CHANNEL = 'yolo-js-sandbox-v1'
const DEFAULT_TIMEOUT_MS = 3000
const MIN_TIMEOUT_MS = 100
const GLOBAL_TIMEOUT_LIMIT_MS = 10000
const READY_TIMEOUT_MS = 3000
const OUTPUT_MAX_BYTES = 50 * 1024
const OUTPUT_PREFIX_CHARS = 48 * 1024

type JsonRecord = Record<string, unknown>

type JsSandboxVariables = {
  $now: string
  $isoDate: string
  $note: {
    path: string
    basename: string
    frontmatter: JsonRecord
  } | null
  $content: string | null
  $selection: string | null
  $vault: {
    name: string
    adapter: {
      basePath: string | null
    }
  }
  $links: string[]
  $tags: string[]
}

type JsSandboxRunResult =
  | {
      ok: true
      json: string
    }
  | {
      ok: false
      error: string
      stack?: string
    }

type PendingRun = {
  resolve: (result: JsSandboxRunResult) => void
  reject: (error: Error) => void
  cleanup: () => void
}

type JsSandboxToolCallResult =
  | {
      status: ToolCallResponseStatus.Success
      text: string
    }
  | {
      status: ToolCallResponseStatus.Error
      error: string
    }
  | {
      status: ToolCallResponseStatus.Aborted
    }

const JS_SANDBOX_WORKER_SCRIPT = String.raw`
const CHANNEL = 'yolo-js-sandbox-v1'
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

function deepFreeze(value) {
  if (
    !value ||
    (typeof value !== 'object' && typeof value !== 'function') ||
    Object.isFrozen(value)
  ) {
    return value
  }
  Object.freeze(value)
  for (const key of Object.keys(value)) {
    deepFreeze(value[key])
  }
  return value
}

function assertArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(name + ' must be an array.')
  }
  return value
}

function assertFiniteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(name + ' must be a finite number.')
  }
  return value
}

function toFiniteNumbers(values, name) {
  assertArray(values, name)
  return values.map((value, index) =>
    assertFiniteNumber(value, name + '[' + index + ']')
  )
}

function getPathValue(value, path) {
  if (typeof path === 'function') {
    return path(value)
  }
  if (typeof path !== 'string' || path.trim() === '') {
    return value
  }
  return path.split('.').reduce((current, part) => {
    if (current === null || current === undefined) {
      return undefined
    }
    return current[part]
  }, value)
}

function flattenJson(value, prefix, output) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      output.push({ path: prefix, value: [] })
      return output
    }
    value.forEach((item, index) => {
      flattenJson(item, prefix ? prefix + '[' + index + ']' : '[' + index + ']', output)
    })
    return output
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) {
      output.push({ path: prefix, value: {} })
      return output
    }
    for (const [key, item] of entries) {
      flattenJson(item, prefix ? prefix + '.' + key : key, output)
    }
    return output
  }
  output.push({ path: prefix, value })
  return output
}

function parseIsoDate(value, name) {
  if (typeof value !== 'string') {
    throw new Error(name + ' must be an ISO date string.')
  }
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    throw new Error(name + ' must use YYYY-MM-DD.')
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (Number.isNaN(date.getTime())) {
    throw new Error(name + ' is not a valid date.')
  }
  return date
}

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10)
}

function assertMatrix(matrix, name) {
  assertArray(matrix, name)
  if (matrix.length === 0) {
    throw new Error(name + ' must not be empty.')
  }
  const width = Array.isArray(matrix[0]) ? matrix[0].length : 0
  if (width === 0) {
    throw new Error(name + ' rows must not be empty.')
  }
  return matrix.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== width) {
      throw new Error(name + ' must be a rectangular matrix.')
    }
    return row.map((value, colIndex) =>
      assertFiniteNumber(value, name + '[' + rowIndex + '][' + colIndex + ']')
    )
  })
}

function applyModulo(value, modulo) {
  if (modulo === undefined || modulo === null) {
    return value
  }
  const mod = assertFiniteNumber(modulo, 'modulo')
  if (mod <= 0) {
    throw new Error('modulo must be positive.')
  }
  return ((value % mod) + mod) % mod
}

function matrixIdentity(size) {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error('size must be a positive integer.')
  }
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => (row === col ? 1 : 0))
  )
}

function matrixMultiply(a, b, options) {
  const left = assertMatrix(a, 'a')
  const right = assertMatrix(b, 'b')
  if (left[0].length !== right.length) {
    throw new Error('a columns must equal b rows.')
  }
  const modulo = options && typeof options === 'object' ? options.modulo : undefined
  return left.map((row) =>
    right[0].map((_, colIndex) => {
      let sum = 0
      for (let i = 0; i < right.length; i += 1) {
        sum = applyModulo(sum + row[i] * right[i][colIndex], modulo)
      }
      return applyModulo(sum, modulo)
    })
  )
}

function createSandboxUtils() {
  const json = {
    flatten(value) {
      return flattenJson(value, '', [])
    },
    groupBy(items, key) {
      return assertArray(items, 'items').reduce((acc, item) => {
        const groupKey = String(getPathValue(item, key))
        if (!acc[groupKey]) acc[groupKey] = []
        acc[groupKey].push(item)
        return acc
      }, {})
    },
    countBy(items, key) {
      return assertArray(items, 'items').reduce((acc, item) => {
        const groupKey = String(getPathValue(item, key))
        acc[groupKey] = (acc[groupKey] || 0) + 1
        return acc
      }, {})
    }
  }

  const text = {
    markdownHeadings(markdown) {
      return String(markdown ?? '')
        .split('\n')
        .map((line, index) => {
          const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
          return match
            ? { level: match[1].length, text: match[2].trim(), line: index + 1 }
            : null
        })
        .filter(Boolean)
    },
    tasks(markdown) {
      return String(markdown ?? '')
        .split('\n')
        .map((line, index) => {
          const match = line.match(/^(\s*)[-*+]\s+\[([ xX-])\]\s+(.*)$/)
          if (!match) return null
          const marker = match[2]
          return {
            checked: marker.toLowerCase() === 'x',
            status: marker === '-' ? 'partial' : marker.toLowerCase() === 'x' ? 'done' : 'todo',
            text: match[3],
            indent: match[1].length,
            line: index + 1
          }
        })
        .filter(Boolean)
    },
    wikilinks(markdown) {
      const regex = /(?<!!)\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g
      const results = []
      let match
      while ((match = regex.exec(String(markdown ?? ''))) !== null) {
        results.push({ target: match[1].trim(), alias: match[2] ? match[2].trim() : null })
      }
      return results
    }
  }

  const stats = {
    sum(values) {
      return toFiniteNumbers(values, 'values').reduce((sum, value) => sum + value, 0)
    },
    mean(values) {
      const numbers = toFiniteNumbers(values, 'values')
      return numbers.length === 0 ? null : stats.sum(numbers) / numbers.length
    },
    median(values) {
      const numbers = toFiniteNumbers(values, 'values').sort((a, b) => a - b)
      if (numbers.length === 0) return null
      const middle = Math.floor(numbers.length / 2)
      return numbers.length % 2
        ? numbers[middle]
        : (numbers[middle - 1] + numbers[middle]) / 2
    },
    percentile(values, p) {
      const numbers = toFiniteNumbers(values, 'values').sort((a, b) => a - b)
      const percentile = assertFiniteNumber(p, 'p')
      if (numbers.length === 0) return null
      if (percentile < 0 || percentile > 100) {
        throw new Error('p must be between 0 and 100.')
      }
      const index = (percentile / 100) * (numbers.length - 1)
      const lower = Math.floor(index)
      const upper = Math.ceil(index)
      if (lower === upper) return numbers[lower]
      return numbers[lower] + (numbers[upper] - numbers[lower]) * (index - lower)
    },
    stdev(values, sample) {
      const numbers = toFiniteNumbers(values, 'values')
      if (numbers.length === 0) return null
      if (sample && numbers.length < 2) return null
      const mean = stats.mean(numbers)
      const denominator = sample ? numbers.length - 1 : numbers.length
      const variance =
        numbers.reduce((sum, value) => sum + (value - mean) ** 2, 0) / denominator
      return Math.sqrt(variance)
    }
  }

  const matrix = {
    identity: matrixIdentity,
    multiply: matrixMultiply,
    pow(value, exponent, options) {
      if (!Number.isInteger(exponent) || exponent < 0) {
        throw new Error('exponent must be a non-negative integer.')
      }
      const base = assertMatrix(value, 'matrix')
      if (base.length !== base[0].length) {
        throw new Error('matrix must be square.')
      }
      let result = matrixIdentity(base.length)
      let factor = base
      let power = exponent
      while (power > 0) {
        if (power % 2 === 1) {
          result = matrixMultiply(result, factor, options)
        }
        power = Math.floor(power / 2)
        if (power > 0) {
          factor = matrixMultiply(factor, factor, options)
        }
      }
      return result
    }
  }

  const date = {
    addDays(isoDate, days) {
      const source = parseIsoDate(isoDate, 'isoDate')
      source.setUTCDate(source.getUTCDate() + assertFiniteNumber(days, 'days'))
      return formatIsoDate(source)
    },
    diffDays(a, b) {
      return Math.round((parseIsoDate(a, 'a') - parseIsoDate(b, 'b')) / 86400000)
    },
    today() {
      return new Date().toISOString().slice(0, 10)
    }
  }

  return deepFreeze({ json, text, stats, matrix, date })
}

const SANDBOX_UTILS = createSandboxUtils()

function disableAmbientCapabilities() {
  const blocked = [
    'fetch',
    'XMLHttpRequest',
    'WebSocket',
    'EventSource',
    'importScripts',
    'Worker',
    'SharedWorker',
    'indexedDB',
    'caches'
  ]
  for (const key of blocked) {
    try {
      Object.defineProperty(globalThis, key, {
        configurable: false,
        enumerable: false,
        writable: false,
        value: undefined
      })
    } catch {
      try {
        globalThis[key] = undefined
      } catch {
        // ignore best-effort lockdown failures
      }
    }
  }
}

function buildScope(rawVars) {
  return {
    $now: rawVars && typeof rawVars.$now === 'string'
      ? new Date(rawVars.$now)
      : new Date(),
    $isoDate: rawVars && typeof rawVars.$isoDate === 'string'
      ? rawVars.$isoDate
      : new Date().toISOString().slice(0, 10),
    $note: rawVars ? rawVars.$note ?? null : null,
    $content: rawVars ? rawVars.$content ?? null : null,
    $selection: rawVars ? rawVars.$selection ?? null : null,
    $vault: rawVars ? rawVars.$vault ?? null : null,
    $links: Array.isArray(rawVars && rawVars.$links) ? rawVars.$links : [],
    $tags: Array.isArray(rawVars && rawVars.$tags) ? rawVars.$tags : [],
    $utils: SANDBOX_UTILS,
    $db: undefined
  }
}

async function runInScope(code, rawVars) {
  const scope = buildScope(rawVars)
  const names = Object.keys(scope)
  const values = names.map((name) => scope[name])

  try {
    const evalFn = new AsyncFunction(
      ...names,
      '__code',
      '"use strict"; return await eval(__code);'
    )
    return await evalFn(...values, code)
  } catch (error) {
    if (!(error instanceof SyntaxError) || !/\breturn\b/.test(code)) {
      throw error
    }
    const returnFn = new AsyncFunction(...names, '"use strict";\n' + code)
    return await returnFn(...values)
  }
}

function serializeResult(value) {
  if (typeof value === 'undefined') {
    return 'null'
  }
  const json = JSON.stringify(value)
  if (typeof json !== 'string') {
    throw new Error('not serializable')
  }
  return json
}

function errorPayload(error) {
  if (error && typeof error === 'object') {
    return {
      error: error.message ? String(error.message) : String(error),
      stack: typeof error.stack === 'string' ? error.stack : undefined
    }
  }
  return { error: String(error) }
}

disableAmbientCapabilities()

self.addEventListener('message', async (event) => {
  const data = event.data
  if (!data || data.channel !== CHANNEL || data.type !== 'run') {
    return
  }

  const token = data.token
  const post = (payload) => {
    self.postMessage({ ...payload, channel: CHANNEL, token })
  }

  try {
    const result = await runInScope(String(data.code ?? ''), data.vars)
    post({ type: 'result', json: serializeResult(result) })
  } catch (error) {
    try {
      post({ type: 'result', json: JSON.stringify(errorPayload(error)) })
    } catch {
      post({
        type: 'result',
        json: JSON.stringify({ error: 'not serializable' })
      })
    }
  }
})
`

const JS_SANDBOX_IFRAME_SCRIPT = String.raw`
const CHANNEL = 'yolo-js-sandbox-v1'
const WORKER_SCRIPT = ${JSON.stringify(JS_SANDBOX_WORKER_SCRIPT)}
const workers = new Map()

function postToParent(payload) {
  parent.postMessage({ ...payload, channel: CHANNEL }, '*')
}

function cleanupWorker(reqId) {
  const entry = workers.get(reqId)
  if (!entry) return
  workers.delete(reqId)
  try {
    entry.worker.terminate()
  } catch {
    // ignore
  }
}

function startRun(data) {
  if (typeof Worker !== 'function' || typeof Blob !== 'function') {
    postToParent({
      type: 'error',
      reqId: data.reqId,
      message: 'Sandbox worker is not available.'
    })
    return
  }

  const token =
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  let worker
  try {
    const blob = new Blob([WORKER_SCRIPT], { type: 'text/javascript' })
    const url = URL.createObjectURL(blob)
    worker = new Worker(url)
    URL.revokeObjectURL(url)
  } catch (error) {
    postToParent({
      type: 'error',
      reqId: data.reqId,
      message: error && error.message ? String(error.message) : String(error)
    })
    return
  }

  workers.set(data.reqId, { worker, token })

  worker.onmessage = (event) => {
    const payload = event.data
    const entry = workers.get(data.reqId)
    if (
      !entry ||
      !payload ||
      payload.channel !== CHANNEL ||
      payload.token !== entry.token
    ) {
      return
    }
    cleanupWorker(data.reqId)
    postToParent({
      type: payload.type,
      reqId: data.reqId,
      json: payload.json,
      message: payload.message,
      stack: payload.stack
    })
  }

  worker.onerror = (event) => {
    cleanupWorker(data.reqId)
    postToParent({
      type: 'error',
      reqId: data.reqId,
      message: event.message || 'Sandbox worker failed.'
    })
  }

  worker.postMessage({
    channel: CHANNEL,
    type: 'run',
    token,
    code: data.code,
    vars: data.vars
  })
}

self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.channel !== CHANNEL) return
  if (data.type === 'run') {
    startRun(data)
  } else if (data.type === 'cancel') {
    cleanupWorker(data.reqId)
  }
})

postToParent({ type: 'ready' })
`

export function getJsSandboxTool(): McpTool {
  return {
    name: JS_SANDBOX_TOOL_NAME,
    description:
      'Execute JavaScript in a sandboxed iframe and return JSON. Browser built-ins are available: Math, Date, JSON, RegExp, Intl, URL, TextEncoder/TextDecoder, crypto.subtle when available, btoa/atob, Promise, Array/Map/Set. YOLO only preloads non-native pure helpers: $utils.json.flatten(v), groupBy(items,key), countBy(items,key); $utils.text.markdownHeadings(md), tasks(md), wikilinks(md); $utils.stats.sum/mean/median/percentile(values,p)/stdev(values,sample); $utils.matrix.identity(size), multiply(a,b,{modulo?}), pow(m,n,{modulo?}); $utils.date.addDays(date,days), diffDays(a,b), today(). key can be a dot path or function. Use browser APIs for base64/hash/regex/sort/unique/simple vector math. Read-only context: $now, $isoDate, $note, $content, $selection, $vault, $links, $tags. Optional timeoutMs is capped globally. No network, vault reads, external scripts, or $db.',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description:
            'JavaScript code to execute. The final expression value, or an explicit return value, is returned as JSON.',
        },
        timeoutMs: {
          type: 'number',
          description: `Optional per-call timeout in milliseconds. Defaults to ${DEFAULT_TIMEOUT_MS}; clamped between ${MIN_TIMEOUT_MS} and ${GLOBAL_TIMEOUT_LIMIT_MS}.`,
        },
      },
      required: ['code'],
    },
  }
}

export function formatJsSandboxToolText(json: string): string {
  let formatted = json
  try {
    formatted = JSON.stringify(JSON.parse(json), null, 2)
  } catch {
    // The worker should only return JSON, but keep the formatter defensive.
  }

  if (getByteLength(formatted) <= OUTPUT_MAX_BYTES) {
    return formatted
  }

  return JSON.stringify(
    {
      warning: `Output exceeded ${OUTPUT_MAX_BYTES} bytes and was truncated.`,
      truncated: true,
      originalBytes: getByteLength(formatted),
      jsonPrefix: formatted.slice(0, OUTPUT_PREFIX_CHARS),
    },
    null,
    2,
  )
}

export async function callJsSandboxTool({
  app,
  args,
  signal,
}: {
  app: App
  args: Record<string, unknown>
  signal?: AbortSignal
}): Promise<JsSandboxToolCallResult> {
  if (signal?.aborted) {
    return { status: ToolCallResponseStatus.Aborted }
  }

  const code = args.code
  if (typeof code !== 'string') {
    return {
      status: ToolCallResponseStatus.Error,
      error: 'code must be a string.',
    }
  }

  try {
    const timeoutMs = resolveJsSandboxTimeoutMs(args)
    const vars = await buildJsSandboxVariables(app)
    const result = await getSharedJsSandboxRunner().run({
      code,
      vars,
      timeoutMs,
      signal,
    })

    if (!result.ok) {
      return {
        status: ToolCallResponseStatus.Success,
        text: formatJsSandboxToolText(
          JSON.stringify({
            error: result.error,
            ...(result.stack ? { stack: result.stack } : {}),
          }),
        ),
      }
    }

    return {
      status: ToolCallResponseStatus.Success,
      text: formatJsSandboxToolText(result.json),
    }
  } catch (error) {
    if (signal?.aborted) {
      return { status: ToolCallResponseStatus.Aborted }
    }

    return {
      status: ToolCallResponseStatus.Error,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export function disposeJsSandbox(): void {
  sharedRunner?.dispose()
  sharedRunner = null
}

function resolveJsSandboxTimeoutMs(args: Record<string, unknown>): number {
  const value = args.timeoutMs
  if (value === undefined || value === null) {
    return DEFAULT_TIMEOUT_MS
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('timeoutMs must be a finite number.')
  }
  return Math.min(
    GLOBAL_TIMEOUT_LIMIT_MS,
    Math.max(MIN_TIMEOUT_MS, Math.floor(value)),
  )
}

async function buildJsSandboxVariables(app: App): Promise<JsSandboxVariables> {
  const now = new Date()
  const file = app.workspace.getActiveFile()
  const cache = file ? app.metadataCache.getFileCache(file) : null
  const frontmatter = sanitizeFrontmatter(cache?.frontmatter)
  const content = file ? await readFileText(app, file) : null
  const selection = file ? getActiveMarkdownSelection(app, file) : null
  const basePath = getVaultBasePath(app)
  const tags = collectTags(cache?.tags, frontmatter)
  const links =
    file && content
      ? collectWikilinkPaths(app, content, file.path).map((item) => item.link)
      : []

  return deepCloneJson({
    $now: now.toISOString(),
    $isoDate: now.toISOString().slice(0, 10),
    $note: file
      ? {
          path: file.path,
          basename: file.basename,
          frontmatter,
        }
      : null,
    $content: content,
    $selection: selection,
    $vault: {
      name: app.vault.getName(),
      adapter: {
        basePath: basePath ?? null,
      },
    },
    $links: links,
    $tags: tags,
  })
}

function getSharedJsSandboxRunner(): JsSandboxRunner {
  if (!sharedRunner) {
    sharedRunner = new JsSandboxRunner()
  }
  return sharedRunner
}

let sharedRunner: JsSandboxRunner | null = null

class JsSandboxRunner {
  private iframe: HTMLIFrameElement | null = null
  private readyPromise: Promise<void> | null = null
  private readyResolve: (() => void) | null = null
  private readyReject: ((error: Error) => void) | null = null
  private pendingRuns = new Map<string, PendingRun>()
  private messageHandler = (event: MessageEvent) => {
    this.handleMessage(event)
  }

  async run({
    code,
    vars,
    timeoutMs,
    signal,
  }: {
    code: string
    vars: JsSandboxVariables
    timeoutMs: number
    signal?: AbortSignal
  }): Promise<JsSandboxRunResult> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new Error('JS sandbox is only available in a browser context.')
    }
    if (signal?.aborted) {
      throw createAbortError()
    }

    await this.ensureReady()

    const targetWindow = this.iframe?.contentWindow
    if (!targetWindow) {
      throw new Error('JS sandbox iframe is not available.')
    }

    const reqId = createRequestId()
    const startedAt = Date.now()
    let timeoutId: number | null = null

    return await new Promise<JsSandboxRunResult>((resolve, reject) => {
      const cleanup = () => {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId)
          timeoutId = null
        }
        signal?.removeEventListener('abort', onAbort)
        this.pendingRuns.delete(reqId)
      }

      const finishTimeout = () => {
        cleanup()
        this.cancelRun(reqId)
        resolve({
          ok: true,
          json: JSON.stringify({
            error: `Execution timed out after ${timeoutMs} ms.`,
          }),
        })
      }

      const scheduleTimeout = () => {
        const elapsed = Date.now() - startedAt
        const remaining = timeoutMs - elapsed
        if (remaining <= 0) {
          finishTimeout()
          return
        }
        timeoutId = window.setTimeout(scheduleTimeout, Math.min(remaining, 250))
      }

      const onAbort = () => {
        cleanup()
        this.cancelRun(reqId)
        reject(createAbortError())
      }

      this.pendingRuns.set(reqId, {
        resolve: (result) => {
          cleanup()
          resolve(result)
        },
        reject: (error) => {
          cleanup()
          reject(error)
        },
        cleanup,
      })

      signal?.addEventListener('abort', onAbort, { once: true })
      scheduleTimeout()

      try {
        targetWindow.postMessage(
          {
            channel: SANDBOX_CHANNEL,
            type: 'run',
            reqId,
            code,
            vars,
          },
          '*',
        )
      } catch (error) {
        cleanup()
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  dispose(): void {
    for (const [reqId, pending] of this.pendingRuns) {
      this.cancelRun(reqId)
      pending.cleanup()
      pending.reject(new Error('JS sandbox disposed.'))
    }
    this.pendingRuns.clear()
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', this.messageHandler)
    }
    this.iframe?.remove()
    this.iframe = null
    this.readyPromise = null
    this.readyResolve = null
    this.readyReject = null
  }

  private ensureReady(): Promise<void> {
    if (this.readyPromise) {
      return this.readyPromise
    }

    window.addEventListener('message', this.messageHandler)
    const iframe = document.createElement('iframe')
    iframe.setAttribute('sandbox', 'allow-scripts')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.hidden = true
    iframe.srcdoc = buildSandboxHtml()
    this.iframe = iframe

    this.readyPromise = new Promise<void>((resolve, reject) => {
      let settled = false
      const timeoutId = window.setTimeout(() => {
        if (settled) {
          return
        }
        settled = true
        this.readyReject = null
        this.readyResolve = null
        reject(new Error('Timed out while initializing JS sandbox.'))
      }, READY_TIMEOUT_MS)
      this.readyResolve = () => {
        if (settled) {
          return
        }
        settled = true
        window.clearTimeout(timeoutId)
        this.readyResolve = null
        this.readyReject = null
        resolve()
      }
      this.readyReject = (error) => {
        if (settled) {
          return
        }
        settled = true
        window.clearTimeout(timeoutId)
        this.readyResolve = null
        this.readyReject = null
        reject(error)
      }
    })

    document.body.appendChild(iframe)
    return this.readyPromise
  }

  private handleMessage(event: MessageEvent): void {
    if (event.source !== this.iframe?.contentWindow) {
      return
    }
    const data = event.data as
      | {
          channel?: string
          type?: string
          reqId?: string
          json?: string
          message?: string
          stack?: string
        }
      | undefined
    if (!data || data.channel !== SANDBOX_CHANNEL) {
      return
    }

    if (data.type === 'ready') {
      this.readyResolve?.()
      return
    }

    if (!data.reqId) {
      return
    }
    const pending = this.pendingRuns.get(data.reqId)
    if (!pending) {
      return
    }

    if (data.type === 'result') {
      if (typeof data.json !== 'string') {
        pending.resolve({ ok: false, error: 'not serializable' })
        return
      }
      pending.resolve({ ok: true, json: data.json })
      return
    }

    if (data.type === 'error') {
      pending.resolve({
        ok: false,
        error: data.message ?? 'Sandbox execution failed.',
        stack: data.stack,
      })
    }
  }

  private cancelRun(reqId: string): void {
    this.iframe?.contentWindow?.postMessage(
      {
        channel: SANDBOX_CHANNEL,
        type: 'cancel',
        reqId,
      },
      '*',
    )
  }
}

function buildSandboxHtml(): string {
  const script = JS_SANDBOX_IFRAME_SCRIPT.replace(/<\/script/gi, '<\\/script')
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><script>${script}</script></body></html>`
}

function createRequestId(): string {
  return `js_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

function createAbortError(): Error {
  const error = new Error('Tool call aborted.')
  error.name = 'AbortError'
  return error
}

function getByteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length
  }
  return value.length
}

function getVaultBasePath(app: App): string | undefined {
  const adapter = app.vault.adapter
  if (adapter instanceof FileSystemAdapter) {
    return adapter.getBasePath()
  }
  const maybeAdapter = adapter as { basePath?: unknown; getBasePath?: unknown }
  if (typeof maybeAdapter.getBasePath === 'function') {
    const value = maybeAdapter.getBasePath()
    return typeof value === 'string' ? value : undefined
  }
  return typeof maybeAdapter.basePath === 'string'
    ? maybeAdapter.basePath
    : undefined
}

async function readFileText(app: App, file: TFile): Promise<string | null> {
  try {
    const vault = app.vault as {
      cachedRead?: (file: TFile) => Promise<string>
      read: (file: TFile) => Promise<string>
    }
    return vault.cachedRead
      ? await vault.cachedRead(file)
      : await vault.read(file)
  } catch {
    return null
  }
}

function getActiveMarkdownSelection(app: App, file: TFile): string | null {
  const view =
    app.workspace
      .getLeavesOfType('markdown')
      .map((leaf) => (leaf.view instanceof MarkdownView ? leaf.view : null))
      .find((candidate): candidate is MarkdownView => {
        return candidate?.file?.path === file.path
      }) ?? null
  const selection = view?.editor?.getSelection?.()
  return selection && selection.length > 0 ? selection : null
}

function sanitizeFrontmatter(
  frontmatter: Record<string, unknown> | null | undefined,
): JsonRecord {
  if (!frontmatter) {
    return {}
  }
  const sanitized: JsonRecord = {}
  for (const [key, value] of Object.entries(frontmatter)) {
    if (key === 'position') {
      continue
    }
    sanitized[key] = value
  }
  return deepCloneJson(sanitized)
}

function collectTags(
  inlineTags:
    | Array<{
        tag?: string
      }>
    | undefined,
  frontmatter: JsonRecord,
): string[] {
  const tags = new Set<string>()
  for (const item of inlineTags ?? []) {
    addTag(tags, item.tag)
  }
  addFrontmatterTags(tags, frontmatter.tags)
  addFrontmatterTags(tags, frontmatter.tag)
  return [...tags].sort((a, b) => a.localeCompare(b))
}

function addFrontmatterTags(tags: Set<string>, value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach((item) => addTag(tags, item))
    return
  }
  if (typeof value === 'string') {
    value
      .split(/[,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => addTag(tags, item))
  }
}

function addTag(tags: Set<string>, value: unknown): void {
  if (typeof value !== 'string') {
    return
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return
  }
  tags.add(trimmed.startsWith('#') ? trimmed : `#${trimmed}`)
}

function deepCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
