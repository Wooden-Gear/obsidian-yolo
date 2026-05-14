import * as Popover from '@radix-ui/react-popover'
import { ArrowDown, ArrowUp, ChevronDown, Clock, Zap } from 'lucide-react'
import { ReactNode, useLayoutEffect, useRef, useState } from 'react'

import { AssistantToolMessageGroup } from '../../types/chat'
import { ResponseUsage } from '../../types/llm/response'
import { YoloPopoverContent } from '../common/popover'

import { LLMResponseInfoEntry, useLLMResponseInfo } from './useLLMResponseInfo'

const formatTokenCount = (value: number) => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }
  return value.toString()
}

const formatDuration = (durationMs: number) => {
  const seconds = durationMs / 1000
  return `${seconds.toFixed(1)}s`
}

type LevelConfig = {
  showSpeedUnit: boolean
  showInputUnit: boolean
  showOutputUnit: boolean
  showInputCachedWord: boolean
  showTime: boolean
  showSpeed: boolean
  showOutput: boolean
  showInputCache: boolean
}

const LEVEL_COUNT = 8

/**
 * Progressive compression — each level drops exactly one thing vs the previous
 * level. This keeps the inline bar's visual change smooth as the container
 * narrows, avoiding the "cliff" where many suffixes disappear at once.
 *
 * Order of things dropped, from least to most important:
 *   1. ⚡ "tok/s"    — icon alone conveys "speed"
 *   2. "tokens"     — on both ↑ and ↓, icons + arrow direction are enough
 *   3. "cached"     — the parens + number next to ↑ remain contextual
 *   4. 🕐 duration  — nice-to-have
 *   5. ⚡ speed     — fully derivable from ↓ and 🕐
 *   6. (cached)     — drop the whole cache breakdown, keep only total input
 *
 * The full detail is accessible via the expanded popover, so these drops never
 * actually hide information — they just move it to a secondary surface.
 */
const configForLevel = (level: number): LevelConfig => ({
  showSpeedUnit: level < 1,
  showInputUnit: level < 2,
  showOutputUnit: level < 2,
  showInputCachedWord: level < 3,
  showTime: level < 4,
  showSpeed: level < 5,
  showOutput: true,
  showInputCache: level < 7,
})

const LEVELS: LevelConfig[] = Array.from({ length: LEVEL_COUNT }, (_, i) =>
  configForLevel(i),
)

type RenderInputs = {
  usage: ResponseUsage | null
  cachedTokens: number | null
  durationMs: number | null
  tokensPerSecond: number | null
}

const getCachedTokens = (usage: ResponseUsage | null) =>
  usage?.cache_read_input_tokens !== undefined &&
  usage.cache_read_input_tokens > 0
    ? usage.cache_read_input_tokens
    : null

const getCacheCreationTokens = (usage: ResponseUsage | null) =>
  usage?.cache_creation_input_tokens !== undefined &&
  usage.cache_creation_input_tokens > 0
    ? usage.cache_creation_input_tokens
    : null

const getTokensPerSecond = (
  usage: ResponseUsage | null,
  durationMs: number | null,
) =>
  usage && durationMs && durationMs > 0
    ? usage.completion_tokens / (durationMs / 1000)
    : null

const formatDetailTokenCount = (value: number) =>
  `${formatTokenCount(value)} tokens`

function renderItems(
  { usage, cachedTokens, durationMs, tokensPerSecond }: RenderInputs,
  {
    showSpeedUnit,
    showInputUnit,
    showOutputUnit,
    showInputCachedWord,
    showTime,
    showSpeed,
    showOutput,
    showInputCache,
  }: LevelConfig,
): ReactNode {
  return (
    <>
      {usage && (
        <span className="yolo-llm-inline-info-item yolo-llm-inline-info-item--input">
          <ArrowUp className="yolo-llm-inline-info-icon yolo-llm-inline-info-icon--input" />
          <span>
            {formatTokenCount(usage.prompt_tokens)}
            {showInputUnit && ' tokens'}
            {showInputCache && cachedTokens !== null && (
              <>
                {' ('}
                {formatTokenCount(cachedTokens)}
                {showInputCachedWord && ' cached'}
                {')'}
              </>
            )}
          </span>
        </span>
      )}
      {showOutput && usage && (
        <span className="yolo-llm-inline-info-item yolo-llm-inline-info-item--output">
          <ArrowDown className="yolo-llm-inline-info-icon yolo-llm-inline-info-icon--output" />
          <span>
            {formatTokenCount(usage.completion_tokens)}
            {showOutputUnit && ' tokens'}
          </span>
        </span>
      )}
      {showSpeed && tokensPerSecond !== null && (
        <span className="yolo-llm-inline-info-item yolo-llm-inline-info-item--speed">
          <Zap className="yolo-llm-inline-info-icon yolo-llm-inline-info-icon--speed" />
          <span>
            {tokensPerSecond.toFixed(1)}
            {showSpeedUnit && ' tok/s'}
          </span>
        </span>
      )}
      {showTime && durationMs !== null && (
        <span className="yolo-llm-inline-info-item yolo-llm-inline-info-item--time">
          <Clock className="yolo-llm-inline-info-icon yolo-llm-inline-info-icon--time" />
          <span>{formatDuration(durationMs)}</span>
        </span>
      )}
    </>
  )
}

function getRequestInputs(request: LLMResponseInfoEntry): RenderInputs {
  return {
    usage: request.usage,
    cachedTokens: getCachedTokens(request.usage),
    durationMs: request.durationMs,
    tokensPerSecond: getTokensPerSecond(request.usage, request.durationMs),
  }
}

function UsageDetailItem({
  icon,
  ariaLabel,
  value,
}: {
  icon: ReactNode
  ariaLabel: string
  value: string
}) {
  return (
    <span
      className="yolo-llm-inline-info-item yolo-llm-inline-info-detail-item"
      aria-label={ariaLabel}
    >
      {icon}
      <span>{value}</span>
    </span>
  )
}

function UsageDetailRow({
  indexLabel,
  inputs,
  isTotal = false,
}: {
  indexLabel: string
  inputs: RenderInputs
  isTotal?: boolean
}) {
  const usage = inputs.usage
  if (!usage) {
    return null
  }

  const cacheRatio =
    inputs.cachedTokens !== null && usage.prompt_tokens > 0
      ? inputs.cachedTokens / usage.prompt_tokens
      : null
  const cacheCreation = getCacheCreationTokens(usage)
  const inputDetails: string[] = [formatDetailTokenCount(usage.prompt_tokens)]

  if (inputs.cachedTokens !== null && cacheRatio !== null) {
    inputDetails.push(
      `(${inputs.cachedTokens.toLocaleString()} cached / ${(
        cacheRatio * 100
      ).toFixed(1)}%)`,
    )
  }

  if (cacheCreation !== null) {
    inputDetails.push(`(${cacheCreation.toLocaleString()} written)`)
  }

  return (
    <div
      className={`yolo-llm-inline-info-detail-row${
        isTotal ? ' yolo-llm-inline-info-detail-row--total' : ''
      }`}
    >
      <div className="yolo-llm-inline-info-detail-index">
        <span>{indexLabel}</span>
      </div>
      <UsageDetailItem
        icon={
          <ArrowUp className="yolo-llm-inline-info-icon yolo-llm-inline-info-icon--input" />
        }
        ariaLabel="Input tokens"
        value={inputDetails.join(' ')}
      />
      <UsageDetailItem
        icon={
          <ArrowDown className="yolo-llm-inline-info-icon yolo-llm-inline-info-icon--output" />
        }
        ariaLabel="Output tokens"
        value={formatDetailTokenCount(usage.completion_tokens)}
      />
      <UsageDetailItem
        icon={
          <Zap className="yolo-llm-inline-info-icon yolo-llm-inline-info-icon--speed" />
        }
        ariaLabel="Speed"
        value={
          inputs.tokensPerSecond !== null
            ? `${inputs.tokensPerSecond.toFixed(1)} tok/s`
            : '-'
        }
      />
      <UsageDetailItem
        icon={
          <Clock className="yolo-llm-inline-info-icon yolo-llm-inline-info-icon--time" />
        }
        ariaLabel="Duration"
        value={
          inputs.durationMs !== null ? formatDuration(inputs.durationMs) : '-'
        }
      />
    </div>
  )
}

export default function LLMResponseInlineInfo({
  messages,
}: {
  messages: AssistantToolMessageGroup
}) {
  const { requests, usage, durationMs } = useLLMResponseInfo(messages)
  const tokensPerSecond = getTokensPerSecond(usage, durationMs)

  const triggerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const ghostRefs = useRef<Array<HTMLDivElement | null>>([])
  const [levelIndex, setLevelIndex] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const widths = ghostRefs.current.map(
      (node) => node?.getBoundingClientRect().width ?? 0,
    )

    const pickLevel = () => {
      const available = container.clientWidth
      for (let i = 0; i < widths.length; i += 1) {
        if (widths[i] <= available) {
          setLevelIndex(i)
          return
        }
      }
      setLevelIndex(widths.length - 1)
    }

    pickLevel()
    const observer = new ResizeObserver(pickLevel)
    observer.observe(container)
    return () => observer.disconnect()
  }, [usage, durationMs])

  if (!usage && durationMs === null && requests.length === 0) {
    return null
  }

  const inputs: RenderInputs = {
    usage,
    cachedTokens: getCachedTokens(usage),
    durationMs,
    tokensPerSecond,
  }

  return (
    <Popover.Root open={isExpanded} onOpenChange={setIsExpanded}>
      <Popover.Trigger asChild>
        <div
          className="yolo-llm-inline-info"
          ref={triggerRef}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          aria-label="Show request usage details"
        >
          <div className="yolo-llm-inline-info-content" ref={containerRef}>
            {renderItems(inputs, LEVELS[levelIndex])}
          </div>
          <ChevronDown
            className={`yolo-llm-inline-info-chevron${
              isExpanded ? ' is-expanded' : ''
            }`}
            aria-hidden="true"
          />
          <div className="yolo-llm-inline-info-ghosts" aria-hidden="true">
            {LEVELS.map((config, i) => (
              <div
                key={i}
                ref={(node) => {
                  ghostRefs.current[i] = node
                }}
                className="yolo-llm-inline-info-content yolo-llm-inline-info-ghost"
              >
                {renderItems(inputs, config)}
              </div>
            ))}
          </div>
        </div>
      </Popover.Trigger>
      <YoloPopoverContent
        anchorRef={triggerRef}
        variant="default"
        maxWidth="min(680px, calc(100vw - 48px))"
        maxHeight="min(70vh, 520px)"
        className="yolo-llm-usage-popover"
        side="top"
        sideOffset={6}
        align="start"
        collisionPadding={8}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          triggerRef.current?.focus({ preventScroll: true })
        }}
      >
        <div
          className="yolo-llm-inline-info-panel"
          role="dialog"
          aria-label="Request usage details"
        >
          <div className="yolo-llm-inline-info-detail-list">
            {requests.map((request) => (
              <UsageDetailRow
                key={request.messageId}
                indexLabel={String(request.requestNumber)}
                inputs={getRequestInputs(request)}
              />
            ))}
            <UsageDetailRow indexLabel={'\u03A3'} inputs={inputs} isTotal />
          </div>
        </div>
      </YoloPopoverContent>
    </Popover.Root>
  )
}
