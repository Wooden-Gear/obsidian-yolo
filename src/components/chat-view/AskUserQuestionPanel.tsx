import { Check, CornerDownLeft, MessageCircleQuestion } from 'lucide-react'
import { Notice } from 'obsidian'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useLanguage } from '../../contexts/language-context'
import { usePlugin } from '../../contexts/plugin-context'
import type {
  AnswerUserQuestionAnswer,
  AnswerUserQuestionPayload,
} from '../../core/agent/service'
import type {
  AskUserQuestionInputType,
  AskUserQuestionItem,
} from '../../core/mcp/localFileTools'
import { validateAskUserQuestionArgs } from '../../core/mcp/localFileTools'
import { ChatMessage } from '../../types/chat'
import {
  ToolCallRequest,
  ToolCallResponse,
  ToolCallResponseStatus,
  getToolCallArgumentsObject,
} from '../../types/tool-call.types'

type AskUserQuestionPanelProps = {
  request: ToolCallRequest
  response: ToolCallResponse
  conversationId: string
  onRecoverAnswerUserQuestion: (payload: {
    resolvedMessages: ChatMessage[]
    toolCallId: string
  }) => void
}

type AnswerState = {
  freeText: Record<string, string>
  singleSelect: Record<string, string>
  multiSelect: Record<string, string[]>
}

const buildInitialAnswers = (questions: AskUserQuestionItem[]): AnswerState => {
  const state: AnswerState = {
    freeText: {},
    singleSelect: {},
    multiSelect: {},
  }
  for (const question of questions) {
    if (question.inputType === 'free_text') {
      state.freeText[question.id] = ''
    } else if (question.inputType === 'single_select') {
      state.singleSelect[question.id] = ''
    } else {
      state.multiSelect[question.id] = []
    }
  }
  return state
}

const isComplete = (
  questions: AskUserQuestionItem[],
  answers: AnswerState,
): boolean => {
  for (const question of questions) {
    if (question.inputType === 'free_text') {
      if ((answers.freeText[question.id] ?? '').trim() === '') return false
    } else if (question.inputType === 'single_select') {
      if (!answers.singleSelect[question.id]) return false
    } else {
      if ((answers.multiSelect[question.id] ?? []).length === 0) return false
    }
  }
  return true
}

const parseSubmittedAnswers = (
  text: string,
): AnswerUserQuestionPayload | null => {
  try {
    const parsed: unknown = JSON.parse(text)
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed) ||
      (parsed as { type?: unknown }).type !== 'user_answers' ||
      !Array.isArray((parsed as { answers?: unknown }).answers)
    ) {
      return null
    }
    return parsed as AnswerUserQuestionPayload
  } catch {
    return null
  }
}

export function AskUserQuestionPanel({
  request,
  response,
  conversationId,
  onRecoverAnswerUserQuestion,
}: AskUserQuestionPanelProps) {
  const plugin = usePlugin()
  const { t } = useLanguage()

  const parsedQuestions = useMemo<AskUserQuestionItem[] | null>(() => {
    const args = getToolCallArgumentsObject(request.arguments)
    if (!args) return null
    const validation = validateAskUserQuestionArgs(args)
    return validation.ok ? validation.value.questions : null
  }, [request.arguments])

  const [answers, setAnswers] = useState<AnswerState>(() =>
    parsedQuestions
      ? buildInitialAnswers(parsedQuestions)
      : {
          freeText: {},
          singleSelect: {},
          multiSelect: {},
        },
  )
  const [submitting, setSubmitting] = useState(false)

  // Reset local state if the panel is keyed to a different tool call but
  // somehow reuses this instance (defensive).
  useEffect(() => {
    if (parsedQuestions) {
      setAnswers(buildInitialAnswers(parsedQuestions))
    }
  }, [parsedQuestions])

  const handleSubmit = useCallback(async () => {
    if (!parsedQuestions || submitting) return
    if (!isComplete(parsedQuestions, answers)) return

    const payload: AnswerUserQuestionPayload = {
      type: 'user_answers',
      answers: parsedQuestions.map<AnswerUserQuestionAnswer>((question) => {
        if (question.inputType === 'free_text') {
          return {
            id: question.id,
            question: question.prompt,
            inputType: 'free_text',
            value: answers.freeText[question.id] ?? '',
          }
        }
        if (question.inputType === 'single_select') {
          return {
            id: question.id,
            question: question.prompt,
            inputType: 'single_select',
            value: answers.singleSelect[question.id] ?? '',
          }
        }
        return {
          id: question.id,
          question: question.prompt,
          inputType: 'multi_select',
          value: [...(answers.multiSelect[question.id] ?? [])],
        }
      }),
    }

    setSubmitting(true)
    try {
      const outcome = await plugin.getAgentService().answerUserQuestion({
        conversationId,
        toolCallId: request.id,
        payload,
      })
      if (outcome.kind === 'needs_recovery') {
        onRecoverAnswerUserQuestion({
          resolvedMessages: outcome.resolvedMessages,
          toolCallId: request.id,
        })
      } else if (
        outcome.kind === 'not_found' ||
        outcome.kind === 'not_awaiting'
      ) {
        new Notice(
          t(
            'chat.askUserQuestion.stale',
            '该提问已过期或已被处理，无法再次提交。',
          ),
        )
      }
    } finally {
      setSubmitting(false)
    }
  }, [
    answers,
    conversationId,
    onRecoverAnswerUserQuestion,
    parsedQuestions,
    plugin,
    request.id,
    submitting,
    t,
  ])

  if (response.status === ToolCallResponseStatus.Rejected) {
    return (
      <PanelShell variant="rejected" titleKey="title" t={t}>
        <div className="yolo-ask-user-question-body">
          {t(
            'chat.askUserQuestion.rejected',
            '系统已拒绝该提问（仅允许每轮一次，或被禁用）。',
          )}
        </div>
      </PanelShell>
    )
  }

  if (response.status === ToolCallResponseStatus.Aborted) {
    return (
      <PanelShell variant="aborted" titleKey="title" t={t}>
        <div className="yolo-ask-user-question-body">
          {t('chat.askUserQuestion.aborted', '已被停止。')}
        </div>
      </PanelShell>
    )
  }

  if (response.status === ToolCallResponseStatus.Error) {
    return (
      <PanelShell variant="error" titleKey="title" t={t}>
        <div className="yolo-ask-user-question-body">
          {t(
            'chat.askUserQuestion.schemaError',
            '模型的提问参数不合法：{{error}}',
          ).replace('{{error}}', response.error)}
        </div>
      </PanelShell>
    )
  }

  // After terminal branches, the gateway invariants guarantee questions
  // parsed cleanly — otherwise the tool call would have been marked Error
  // before reaching AwaitingUserInput / Success.
  if (!parsedQuestions) {
    throw new Error(
      'ask_user_question: parsedQuestions is null in a non-terminal state — gateway invariant violated',
    )
  }

  if (response.status === ToolCallResponseStatus.Success) {
    const payload = parseSubmittedAnswers(response.data.text)
    return (
      <PanelShell variant="answered" titleKey="title" t={t}>
        <div className="yolo-ask-user-question-questions">
          {parsedQuestions.map((question) => {
            const answer = payload?.answers.find((a) => a.id === question.id)
            return (
              <div
                key={question.id}
                className="yolo-ask-user-question-item yolo-ask-user-question-item--answered"
              >
                <div className="yolo-ask-user-question-prompt">
                  <Check
                    size={12}
                    className="yolo-ask-user-question-answered-icon"
                  />
                  <span>{question.prompt}</span>
                </div>
                <div className="yolo-ask-user-question-answer">
                  {renderAnsweredValue(question, answer)}
                </div>
              </div>
            )
          })}
        </div>
        <div className="yolo-ask-user-question-footer-meta">
          {t('chat.askUserQuestion.answeredBadge', '已提交')}
        </div>
      </PanelShell>
    )
  }

  // Pending (AwaitingUserInput) — interactive form.
  const complete = isComplete(parsedQuestions, answers)
  return (
    <PanelShell variant="pending" titleKey="title" t={t}>
      <div className="yolo-ask-user-question-questions">
        {parsedQuestions.map((question) => (
          <QuestionRow
            key={question.id}
            question={question}
            answers={answers}
            setAnswers={setAnswers}
            onSubmit={() => void handleSubmit()}
          />
        ))}
      </div>
      <div className="yolo-ask-user-question-footer">
        <span className="yolo-ask-user-question-footer-hint">
          {t('chat.askUserQuestion.submitHint', 'Cmd / Ctrl + Enter 提交')}
        </span>
        <button
          type="button"
          className="yolo-ask-user-question-submit"
          disabled={!complete || submitting}
          onClick={() => void handleSubmit()}
        >
          <span>{t('chat.askUserQuestion.submit', '提交答案')}</span>
          <CornerDownLeft size={12} />
        </button>
      </div>
    </PanelShell>
  )
}

function PanelShell({
  variant,
  titleKey,
  t,
  children,
}: {
  variant: 'pending' | 'answered' | 'error' | 'rejected' | 'aborted'
  titleKey: 'title'
  t: ReturnType<typeof useLanguage>['t']
  children: React.ReactNode
}) {
  return (
    <div
      className={`yolo-ask-user-question yolo-ask-user-question--${variant}`}
    >
      <div className="yolo-ask-user-question-header">
        <MessageCircleQuestion size={14} />
        <span>{t(`chat.askUserQuestion.${titleKey}`, '模型向你发起提问')}</span>
      </div>
      {children}
    </div>
  )
}

function QuestionRow({
  question,
  answers,
  setAnswers,
  onSubmit,
}: {
  question: AskUserQuestionItem
  answers: AnswerState
  setAnswers: React.Dispatch<React.SetStateAction<AnswerState>>
  onSubmit: () => void
}) {
  if (question.inputType === 'single_select') {
    const selected = answers.singleSelect[question.id] ?? ''
    return (
      <div className="yolo-ask-user-question-item">
        <div className="yolo-ask-user-question-prompt">{question.prompt}</div>
        <div className="yolo-ask-user-question-chips">
          {(question.options ?? []).map((option) => {
            const isSelected = selected === option.id
            return (
              <button
                key={option.id}
                type="button"
                className={`yolo-ask-user-question-chip${
                  isSelected ? ' yolo-ask-user-question-chip--selected' : ''
                }`}
                onClick={() =>
                  setAnswers((prev) => ({
                    ...prev,
                    singleSelect: {
                      ...prev.singleSelect,
                      [question.id]: option.id,
                    },
                  }))
                }
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (question.inputType === 'multi_select') {
    const selected = answers.multiSelect[question.id] ?? []
    return (
      <div className="yolo-ask-user-question-item">
        <div className="yolo-ask-user-question-prompt">{question.prompt}</div>
        <div className="yolo-ask-user-question-checkboxes">
          {(question.options ?? []).map((option) => {
            const isSelected = selected.includes(option.id)
            return (
              <label
                key={option.id}
                className="yolo-ask-user-question-checkbox-label"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setAnswers((prev) => {
                      const current = prev.multiSelect[question.id] ?? []
                      const next = checked
                        ? [...current, option.id]
                        : current.filter((id) => id !== option.id)
                      return {
                        ...prev,
                        multiSelect: {
                          ...prev.multiSelect,
                          [question.id]: next,
                        },
                      }
                    })
                  }}
                />
                <span>{option.label}</span>
              </label>
            )
          })}
        </div>
      </div>
    )
  }

  // free_text
  const value = answers.freeText[question.id] ?? ''
  return (
    <div className="yolo-ask-user-question-item">
      <div className="yolo-ask-user-question-prompt">{question.prompt}</div>
      <textarea
        className="yolo-ask-user-question-textarea"
        rows={3}
        value={value}
        onChange={(event) =>
          setAnswers((prev) => ({
            ...prev,
            freeText: {
              ...prev.freeText,
              [question.id]: event.target.value,
            },
          }))
        }
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            (event.metaKey || event.ctrlKey) &&
            !event.shiftKey
          ) {
            event.preventDefault()
            onSubmit()
          }
        }}
      />
    </div>
  )
}

function renderAnsweredValue(
  question: AskUserQuestionItem,
  answer: AnswerUserQuestionAnswer | undefined,
): string {
  if (!answer) return '—'
  if (question.inputType === 'single_select') {
    const id = typeof answer.value === 'string' ? answer.value : ''
    return (
      question.options?.find((option) => option.id === id)?.label ?? id ?? '—'
    )
  }
  if (question.inputType === 'multi_select') {
    const ids: string[] = Array.isArray(answer.value) ? answer.value : []
    if (ids.length === 0) return '—'
    return ids
      .map(
        (id) =>
          question.options?.find((option) => option.id === id)?.label ?? id,
      )
      .join(' / ')
  }
  return typeof answer.value === 'string' ? answer.value : '—'
}

export function isAskUserQuestionInputType(
  value: string,
): value is AskUserQuestionInputType {
  return (
    value === 'free_text' ||
    value === 'single_select' ||
    value === 'multi_select'
  )
}
