// 实时任务工具卡：终端样式
// 布局：状态条 → Progress（始终展开+自动滚底） → Output → metadata chips
//
// 设计要点：
// - Progress 用 <pre> 容器配合每行 <span class> 渲染，variant 决定行着色
// - metadata 从 progress 文本解析，失败整块隐藏

import cx from 'clsx'
import {
  Check,
  Clock,
  Coins,
  DollarSign,
  Loader2,
  RefreshCw,
  Square,
  X,
} from 'lucide-react'
import { useMemo } from 'react'

import { useApp } from '../../../contexts/app-context'
import { useLanguage } from '../../../contexts/language-context'
import { useSettings } from '../../../contexts/settings-context'
import { useLiveTaskStream } from '../../../hooks/useLiveTaskStream'
import { ToolCallResponseStatus } from '../../../types/tool-call.types'
import type { ToolCallResponse } from '../../../types/tool-call.types'

export type LiveTaskVariant = 'external-agent' | 'subagent' | 'terminal'

export type LiveTaskArgs = {
  provider?: string
  model?: string
  workingDirectory?: string
  title?: string
  command?: string
}

type LiveTaskCardProps = {
  toolCallId: string
  response: ToolCallResponse
  variant: LiveTaskVariant
  /** 用于在状态条显示 provider · model · cwd 摘要 */
  args?: LiveTaskArgs
  initialStdout?: string
  initialStderr?: string
  /** 用于在 running 状态显示终止按钮 */
  onAbort?: () => void
}

type Truncated = { totalBytes: number; omittedBytes: number }

type ProgressMeta = {
  durationMs?: number
  costUsd?: number
  turns?: number
  tokens?: number
}

export function LiveTaskCard({
  toolCallId,
  response,
  variant,
  args,
  initialStdout,
  initialStderr,
  onAbort,
}: LiveTaskCardProps) {
  const { t } = useLanguage()
  const app = useApp()
  const { settings } = useSettings()
  const stream = useLiveTaskStream(toolCallId, { app, settings, kind: variant })

  const effectiveStatus =
    stream?.source === 'live'
      ? mapLiveStatusToToolStatus(stream.status, response.status)
      : response.status
  const isRunning = effectiveStatus === ToolCallResponseStatus.Running

  // ── 决定文本来源 ──
  let stderrText: string | undefined
  let stdoutText: string | undefined
  let fallbackText: string | undefined
  let progressTruncated: Truncated | undefined
  if (stream !== null && stream.source === 'live') {
    stderrText = stream.stderr || undefined
    stdoutText = stream.stdout || undefined
    // 边角：spawn 失败这类场景，runner 已 push 了 starting/running 但 stdout/stderr 都为空，
    // 这时 stream !== null 会吃掉 response.error 的显示。回退到 fallbackText 让真实错误浮上来。
    if (
      response.status === ToolCallResponseStatus.Error &&
      !stderrText &&
      !stdoutText
    ) {
      fallbackText = response.error
    }
  } else if (stream !== null && stream.source === 'historical') {
    stderrText = stream.stderr || undefined
    progressTruncated = stream.truncated
    if (response.status === ToolCallResponseStatus.Success) {
      stdoutText = response.data.text || undefined
    } else if (
      response.status === ToolCallResponseStatus.Aborted &&
      response.data
    ) {
      stdoutText = response.data.text || undefined
    } else if (response.status === ToolCallResponseStatus.Error) {
      // Error 状态下保留错误文本，否则进度缓存会把原本的错误信息盖掉
      fallbackText = response.error
    }
  } else if (response.status === ToolCallResponseStatus.Success) {
    stderrText = initialStderr || undefined
    stdoutText = initialStdout || response.data.text || undefined
    if (!stderrText && !stdoutText) fallbackText = response.data.text
  } else if (
    response.status === ToolCallResponseStatus.Aborted &&
    response.data
  ) {
    stderrText = initialStderr || undefined
    stdoutText = initialStdout || response.data.text || undefined
    if (!stderrText && !stdoutText) fallbackText = response.data.text
  } else if (response.status === ToolCallResponseStatus.Error) {
    stderrText = initialStderr || undefined
    stdoutText = initialStdout || undefined
    if (!stderrText && !stdoutText) fallbackText = response.error
  }

  // ── 从 stderr 解析 metadata（失败则不显示）──
  const meta = useMemo<ProgressMeta>(
    () => parseProgressMeta(stderrText, variant),
    [stderrText, variant],
  )

  const hasMeta =
    meta.durationMs !== undefined ||
    meta.costUsd !== undefined ||
    meta.turns !== undefined ||
    meta.tokens !== undefined

  if (variant === 'subagent' || variant === 'terminal') {
    const compactText = [stderrText, stdoutText, fallbackText]
      .filter((text): text is string => Boolean(text))
      .join('\n')

    return (
      <CompactLiveTaskCard
        text={compactText}
        status={effectiveStatus}
        variant={variant}
        response={response}
        stream={stream}
        onAbort={onAbort}
        t={t}
      />
    )
  }

  return (
    <div className="yolo-external-agent-card">
      {/* 状态条 */}
      <div className="yolo-external-agent-card__status-row">
        <StatusBadge status={effectiveStatus} t={t} />
        <ArgsInline args={args} />
        {isRunning && onAbort && (
          <button
            type="button"
            className="yolo-external-agent-card__abort-btn"
            onClick={() => void onAbort?.()}
            title={t('chat.toolCall.abort', 'Abort')}
          >
            <Square size={12} />
            <span>{t('chat.toolCall.abort', 'Abort')}</span>
          </button>
        )}
      </div>

      {/* Progress 块 */}
      {stderrText !== undefined && (
        <div className="yolo-external-agent-card__stream-section">
          <div className="yolo-external-agent-card__stream-label">
            {t('chat.externalAgent.progress', 'Progress')}
          </div>
          <ConsoleBlock text={stderrText} variant={variant} />
          {progressTruncated && (
            <div className="yolo-external-agent-card__truncation-notice">
              {t(
                'chat.externalAgent.progressTruncated',
                `Progress truncated: ${progressTruncated.omittedBytes.toLocaleString()} bytes omitted.`,
              )}
            </div>
          )}
        </div>
      )}

      {/* Output 块 */}
      {stdoutText !== undefined && (
        <div className="yolo-external-agent-card__stream-section">
          <div className="yolo-external-agent-card__stream-label">
            {t('chat.externalAgent.output', 'Output')}
          </div>
          <ConsoleBlock text={stdoutText} />
        </div>
      )}

      {/* 历史/错误路径单块输出 */}
      {fallbackText !== undefined && <ConsoleBlock text={fallbackText} />}

      {/* Aborted 无输出文案 */}
      {response.status === ToolCallResponseStatus.Aborted &&
        !response.data &&
        stream === null && (
          <div className="yolo-external-agent-card__no-output">
            {t(
              'chat.externalAgent.abortedBeforeOutput',
              'Aborted before any output was collected.',
            )}
          </div>
        )}

      {/* metadata chips */}
      {hasMeta && <MetaRow meta={meta} />}

      {/* output 截断提示 */}
      <TruncationNotice response={response} t={t} />
    </div>
  )
}

// ──────── 子组件 ────────

function ArgsInline({ args }: { args?: LiveTaskArgs }) {
  if (!args) return null
  const parts: string[] = []
  if (args.provider) parts.push(args.provider)
  if (args.model) parts.push(args.model)
  if (args.title) parts.push(args.title)
  if (args.command) parts.push(args.command)
  if (parts.length === 0 && !args.workingDirectory) return null

  return (
    <div className="yolo-external-agent-card__meta-inline">
      {parts.map((p, i) => (
        <span key={p}>
          {i > 0 && (
            <span className="yolo-external-agent-card__meta-inline-sep">
              {' · '}
            </span>
          )}
          {p}
        </span>
      ))}
      {args.workingDirectory && (
        <>
          {parts.length > 0 && (
            <span className="yolo-external-agent-card__meta-inline-sep">
              {' · '}
            </span>
          )}
          <span
            className="yolo-external-agent-card__cwd"
            title={args.workingDirectory}
          >
            {args.workingDirectory}
          </span>
        </>
      )}
    </div>
  )
}

function CompactLiveTaskCard({
  text,
  status,
  variant,
  response,
  stream,
  onAbort,
  t,
}: {
  text: string
  status: ToolCallResponseStatus
  variant: LiveTaskVariant
  response: ToolCallResponse
  stream: ReturnType<typeof useLiveTaskStream>
  onAbort?: () => void
  t: (key: string, fallback?: string) => string
}) {
  const isRunning = status === ToolCallResponseStatus.Running

  return (
    <div className="yolo-external-agent-card yolo-external-agent-card--compact">
      <div className="yolo-external-agent-card__compact-console-wrap">
        <div className="yolo-external-agent-card__compact-status">
          {isRunning && onAbort ? (
            <button
              type="button"
              className="yolo-external-agent-card__compact-abort-btn"
              onClick={() => void onAbort()}
              title={t('chat.toolCall.abort', 'Abort')}
            >
              <Square size={12} />
            </button>
          ) : (
            <StatusBadge status={status} t={t} />
          )}
        </div>
        {text ? (
          <ConsoleBlock text={text} variant={variant} tone="output" />
        ) : response.status === ToolCallResponseStatus.Aborted &&
          !response.data &&
          stream === null ? (
          <div className="yolo-external-agent-card__no-output">
            {t(
              'chat.externalAgent.abortedBeforeOutput',
              'Aborted before any output was collected.',
            )}
          </div>
        ) : (
          <ConsoleBlock text="" variant={variant} tone="output" />
        )}
      </div>
      <TruncationNotice response={response} t={t} />
    </div>
  )
}

/**
 * 终端日志块。展示全部高度，超长由外层聊天视图滚动。
 */
function ConsoleBlock({
  text,
  variant,
  tone = 'progress',
}: {
  text: string
  variant?: LiveTaskVariant
  tone?: 'progress' | 'output'
}) {
  if (variant) {
    const lines = text.split('\n')
    return (
      <pre
        className={cx(
          'yolo-external-agent-card__console',
          tone === 'progress' && 'yolo-external-agent-card__console--progress',
        )}
      >
        {lines.map((line, i) => (
          <span
            key={i}
            className={cx(
              'yolo-external-agent-card__line',
              progressLineClass(line, variant),
            )}
          >
            {line}
          </span>
        ))}
      </pre>
    )
  }

  return <pre className="yolo-external-agent-card__console">{text}</pre>
}

function progressLineClass(
  line: string,
  variant: LiveTaskVariant,
): string | undefined {
  if (variant === 'subagent') {
    if (/\b(error|failed|aborted)\b/i.test(line)) {
      return 'yolo-external-agent-card__line--parse-error'
    }
    if (/\b(completed|done)\b/i.test(line)) {
      return 'yolo-external-agent-card__line--done'
    }
    if (line.startsWith('[tool]')) return 'yolo-external-agent-card__line--tool'
    if (line.startsWith('[state]'))
      return 'yolo-external-agent-card__line--system'
    return undefined
  }

  if (variant === 'terminal') {
    if (/\b(error|failed|denied|killed|timeout)\b/i.test(line)) {
      return 'yolo-external-agent-card__line--parse-error'
    }
    return undefined
  }

  // ── claude 标签前缀 ──
  if (line.startsWith('[system]'))
    return 'yolo-external-agent-card__line--system'
  if (line.startsWith('[thinking]'))
    return 'yolo-external-agent-card__line--thinking'
  if (line.startsWith('[tool result]'))
    return 'yolo-external-agent-card__line--tool-result'
  if (line.startsWith('[tool]')) return 'yolo-external-agent-card__line--tool'
  if (line.startsWith('[done]')) return 'yolo-external-agent-card__line--done'
  if (line.startsWith('[parse error]') || line.startsWith('[event]'))
    return 'yolo-external-agent-card__line--parse-error'

  // ── codex 原生格式 ──
  const trimmed = line.trim()
  if (trimmed === '') return undefined
  if (/^-{3,}$/.test(trimmed)) return 'yolo-external-agent-card__line--system'
  if (
    trimmed === 'user' ||
    trimmed === 'codex' ||
    trimmed === 'exec' ||
    trimmed === 'tokens used'
  )
    return 'yolo-external-agent-card__line--section'
  if (trimmed.startsWith('succeeded in'))
    return 'yolo-external-agent-card__line--tool-result'
  if (/\b(ERROR|WARN|WARNING)\b/.test(line))
    return 'yolo-external-agent-card__line--parse-error'
  // codex 横幅元数据 key: value 行
  if (
    /^(workdir|model|provider|approval|sandbox|reasoning effort|reasoning summaries|session id):/.test(
      trimmed,
    )
  )
    return 'yolo-external-agent-card__line--system'

  return undefined
}

function parseProgressMeta(
  stderrText: string | undefined,
  variant: LiveTaskVariant,
): ProgressMeta {
  if (!stderrText || variant !== 'external-agent') return {}
  const out: ProgressMeta = {}

  const claudeDone = stderrText.match(
    /\[done\] duration=(\d+)ms cost=\$([\d.]+) turns=(\d+)/,
  )
  if (claudeDone) {
    out.durationMs = parseInt(claudeDone[1], 10)
    out.costUsd = parseFloat(claudeDone[2])
    out.turns = parseInt(claudeDone[3], 10)
  }

  const codexTokens = stderrText.match(/tokens used\s*\n?\s*([\d,]+)/)
  if (codexTokens) {
    out.tokens = parseInt(codexTokens[1].replace(/,/g, ''), 10)
  }

  return out
}

function mapLiveStatusToToolStatus(
  status: 'starting' | 'running' | 'done',
  fallback: ToolCallResponseStatus,
): ToolCallResponseStatus {
  if (status === 'starting' || status === 'running') {
    return ToolCallResponseStatus.Running
  }
  if (fallback === ToolCallResponseStatus.Error) return fallback
  if (fallback === ToolCallResponseStatus.Aborted) return fallback
  return ToolCallResponseStatus.Success
}

function MetaRow({ meta }: { meta: ProgressMeta }) {
  return (
    <div className="yolo-external-agent-card__meta-row">
      {meta.durationMs !== undefined && (
        <span className="yolo-external-agent-card__chip">
          <Clock size={12} className="yolo-external-agent-card__chip-icon" />
          {formatDuration(meta.durationMs)}
        </span>
      )}
      {meta.tokens !== undefined && (
        <span className="yolo-external-agent-card__chip">
          <Coins size={12} className="yolo-external-agent-card__chip-icon" />
          {meta.tokens.toLocaleString()}
        </span>
      )}
      {meta.costUsd !== undefined && (
        <span className="yolo-external-agent-card__chip">
          <DollarSign
            size={12}
            className="yolo-external-agent-card__chip-icon"
          />
          {meta.costUsd.toFixed(4)}
        </span>
      )}
      {meta.turns !== undefined && (
        <span className="yolo-external-agent-card__chip">
          <RefreshCw
            size={12}
            className="yolo-external-agent-card__chip-icon"
          />
          {meta.turns}t
        </span>
      )}
    </div>
  )
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds - minutes * 60)
  return `${minutes}m${rest}s`
}

function TruncationNotice({
  response,
  t,
}: {
  response: ToolCallResponse
  t: (key: string, fallback?: string) => string
}) {
  let truncated: Truncated | undefined

  if (
    response.status === ToolCallResponseStatus.Success &&
    response.data.metadata?.truncated
  ) {
    truncated = response.data.metadata.truncated
  } else if (
    response.status === ToolCallResponseStatus.Aborted &&
    response.data?.metadata?.truncated
  ) {
    truncated = response.data.metadata.truncated
  }

  if (!truncated) return null

  return (
    <div className="yolo-external-agent-card__truncation-notice">
      {t(
        'chat.externalAgent.truncated',
        `Output truncated: ${truncated.omittedBytes.toLocaleString()} bytes omitted.`,
      )}
    </div>
  )
}

function StatusBadge({
  status,
  t,
}: {
  status: ToolCallResponseStatus
  t: (key: string, fallback?: string) => string
}) {
  switch (status) {
    case ToolCallResponseStatus.Running:
      return (
        <span
          className={cx(
            'yolo-external-agent-card__badge',
            'yolo-external-agent-card__badge--running',
          )}
        >
          <Loader2 size={12} className="yolo-spinner" />
          <span>{t('chat.externalAgent.statusRunning', 'Running')}</span>
        </span>
      )
    case ToolCallResponseStatus.Success:
      return (
        <span
          className={cx(
            'yolo-external-agent-card__badge',
            'yolo-external-agent-card__badge--success',
          )}
        >
          <Check size={12} />
          <span>{t('chat.externalAgent.statusDone', 'Done')}</span>
        </span>
      )
    case ToolCallResponseStatus.Aborted:
      return (
        <span
          className={cx(
            'yolo-external-agent-card__badge',
            'yolo-external-agent-card__badge--aborted',
          )}
        >
          <X size={12} />
          <span>{t('chat.externalAgent.statusAborted', 'Aborted')}</span>
        </span>
      )
    case ToolCallResponseStatus.Error:
      return (
        <span
          className={cx(
            'yolo-external-agent-card__badge',
            'yolo-external-agent-card__badge--error',
          )}
        >
          <X size={12} />
          <span>{t('chat.externalAgent.statusError', 'Error')}</span>
        </span>
      )
    default:
      return null
  }
}
