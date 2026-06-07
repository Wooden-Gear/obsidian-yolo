import cx from 'clsx'
import { Bot, Check, Loader2, Square, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useApp } from '../../../contexts/app-context'
import { useLanguage } from '../../../contexts/language-context'
import { useSettings } from '../../../contexts/settings-context'
import { useLiveTaskStream } from '../../../hooks/useLiveTaskStream'
import type { ChatSubagentResultMessage } from '../../../types/chat'
import {
  type ToolCallResponse,
  ToolCallResponseStatus,
} from '../../../types/tool-call.types'

import {
  type SubagentCardArgs,
  buildSubagentCompletionSummary,
  collectSubagentActivityText,
  getLatestActivityLine,
  normalizeActivityLines,
  parseAcceptedSubagentResponse,
  resolveSubagentEffectiveStatus,
} from './subagentCardUtils'
import { SubagentDetailModal } from './SubagentDetailModal'

type SubagentCardProps = {
  toolCallId: string
  response: ToolCallResponse
  args?: SubagentCardArgs
  subagentResult?: ChatSubagentResultMessage
  initialStdout?: string
  initialStderr?: string
  onAbort?: () => void
}

function SubagentStatusIcon({ status }: { status: ToolCallResponseStatus }) {
  switch (status) {
    case ToolCallResponseStatus.Running:
      return <Loader2 size={14} className="yolo-spinner" />
    case ToolCallResponseStatus.Success:
      return <Check size={14} />
    case ToolCallResponseStatus.Aborted:
    case ToolCallResponseStatus.Error:
      return <X size={14} />
    default:
      return <Bot size={14} />
  }
}

export function SubagentCard({
  toolCallId,
  response,
  args,
  subagentResult,
  initialStdout,
  initialStderr,
  onAbort,
}: SubagentCardProps) {
  const { t } = useLanguage()
  const app = useApp()
  const { settings } = useSettings()
  const stream = useLiveTaskStream(toolCallId, {
    app,
    settings,
    kind: 'subagent',
  })
  const [isModalOpen, setIsModalOpen] = useState(false)

  const accepted = useMemo(
    () => parseAcceptedSubagentResponse(response),
    [response],
  )

  const effectiveStatus = resolveSubagentEffectiveStatus({
    subagentResult,
    stream,
    response,
  })
  const isRunning = effectiveStatus === ToolCallResponseStatus.Running

  const title =
    args?.title || subagentResult?.title || accepted.title || toolCallId
  const modelName = subagentResult?.modelName || accepted.modelName

  const fallbackError =
    response.status === ToolCallResponseStatus.Error
      ? response.error
      : undefined

  const activityText = useMemo(
    () =>
      collectSubagentActivityText({
        subagentResult,
        stream,
        initialStderr,
        initialStdout,
        fallbackError,
      }),
    [subagentResult, stream, initialStderr, initialStdout, fallbackError],
  )

  const activityLines = useMemo(
    () => normalizeActivityLines(activityText),
    [activityText],
  )

  const subtitle = subagentResult
    ? buildSubagentCompletionSummary({ subagentResult, t })
    : getLatestActivityLine(activityLines) ||
      (isRunning
        ? t('chat.subagent.planningNextMoves', 'Planning next moves')
        : t('chat.subagent.noActivity', 'No activity yet.'))

  const taskId = subagentResult?.taskId || accepted.taskId
  const prompt = subagentResult?.prompt

  return (
    <>
      <div
        className={cx(
          'yolo-subagent-card',
          isRunning && 'yolo-subagent-card--running',
          effectiveStatus === ToolCallResponseStatus.Success &&
            'yolo-subagent-card--success',
          effectiveStatus === ToolCallResponseStatus.Error &&
            'yolo-subagent-card--error',
          effectiveStatus === ToolCallResponseStatus.Aborted &&
            'yolo-subagent-card--aborted',
        )}
      >
        <button
          type="button"
          className="yolo-subagent-card__main"
          onClick={() => setIsModalOpen(true)}
          aria-label={t('chat.subagent.openDetails', 'View subagent details')}
        >
          <span className="yolo-subagent-card__icon">
            <SubagentStatusIcon status={effectiveStatus} />
          </span>
          <span className="yolo-subagent-card__content">
            <span className="yolo-subagent-card__primary">
              <span className="yolo-subagent-card__title">{title}</span>
              {modelName && (
                <span className="yolo-subagent-card__model">{modelName}</span>
              )}
            </span>
            <span className="yolo-subagent-card__summary">{subtitle}</span>
          </span>
        </button>
        {isRunning && onAbort && (
          <button
            type="button"
            className="yolo-subagent-card__abort-btn"
            onClick={(event) => {
              event.stopPropagation()
              void onAbort()
            }}
            title={t('chat.toolCall.abort', 'Abort')}
          >
            <Square size={12} />
          </button>
        )}
      </div>

      {isModalOpen && (
        <SubagentDetailModal
          title={title}
          modelName={modelName}
          prompt={prompt}
          taskId={taskId}
          effectiveStatus={effectiveStatus}
          subagentResult={subagentResult}
          activityLines={activityLines}
          stream={stream}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  )
}
