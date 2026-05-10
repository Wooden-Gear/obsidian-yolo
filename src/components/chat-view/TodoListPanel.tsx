import cx from 'clsx'
import { Check, ChevronDown, Circle, ListTodo, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useLanguage } from '../../contexts/language-context'
import {
  type TodoItem,
  type TodoStatus,
  deriveTodosFromMessages,
  findLatestCompletedTodoWriteId,
  findTodoSeriesStartId,
} from '../../core/agent/todos-from-messages'
import type { ChatMessage } from '../../types/chat'

type Props = {
  messages: ReadonlyArray<ChatMessage>
}

export function TodoListPanel({ messages }: Props) {
  const todos = useMemo(() => deriveTodosFromMessages(messages), [messages])
  const seriesStartId = useMemo(
    () => findTodoSeriesStartId(messages),
    [messages],
  )
  const completedWriteId = useMemo(
    () => findLatestCompletedTodoWriteId(messages),
    [messages],
  )
  const { t } = useLanguage()
  const [expanded, setExpanded] = useState(true)

  // Auto-expand only when a new todo "series" begins (see findTodoSeriesStartId
  // for the definition). Updates within an active series keep the user's
  // collapse choice — Chat.tsx never unmounts this component, so we can't rely
  // on useState's initial value to do this for us.
  useEffect(() => {
    if (seriesStartId !== null) setExpanded(true)
  }, [seriesStartId])

  // Auto-collapse the moment a write lands that marks every item completed —
  // the body becomes informational rather than actionable. Fires only when
  // completedWriteId changes (i.e. a new "everything done" write), so user
  // re-expanding an all-completed list later won't be overridden.
  useEffect(() => {
    if (completedWriteId !== null) setExpanded(false)
  }, [completedWriteId])

  if (todos.length === 0) return null

  const total = todos.length
  const completed = todos.filter((item) => item.status === 'completed').length

  const summaryTpl = t(
    'chat.todoPanel.summary',
    '共 {total} 个任务，已完成 {completed} 个',
  )
  const summary = summaryTpl
    .replace('{total}', String(total))
    .replace('{completed}', String(completed))

  const collapseLabel = expanded
    ? t('chat.todoPanel.collapse', '收起')
    : t('chat.todoPanel.expand', '展开')

  return (
    <div
      className={cx(
        'yolo-todo-panel',
        expanded ? 'yolo-todo-panel--expanded' : 'yolo-todo-panel--collapsed',
      )}
    >
      <button
        type="button"
        className="yolo-todo-panel__header"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-label={collapseLabel}
        title={collapseLabel}
      >
        <ListTodo
          className="yolo-todo-panel__header-icon"
          size={14}
          aria-hidden
        />
        <span className="yolo-todo-panel__summary">{summary}</span>
        <ChevronDown className="yolo-todo-panel__caret" size={14} aria-hidden />
      </button>
      <div className="yolo-todo-panel__body">
        <div className="yolo-todo-panel__body-inner">
          <ol className="yolo-todo-panel__list">
            {todos.map((item, index) => (
              <TodoRow key={index} item={item} index={index} />
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}

function TodoRow({ item, index }: { item: TodoItem; index: number }) {
  const text = item.content
  return (
    <li
      className={cx(
        'yolo-todo-panel__item',
        `yolo-todo-panel__item--${item.status}`,
      )}
    >
      <span className="yolo-todo-panel__icon" aria-hidden>
        <StatusIcon status={item.status} />
      </span>
      <span className="yolo-todo-panel__index">{index + 1}.</span>
      <span className="yolo-todo-panel__text">{text}</span>
    </li>
  )
}

function StatusIcon({ status }: { status: TodoStatus }) {
  if (status === 'completed') {
    return <Check size={14} strokeWidth={2.5} />
  }
  if (status === 'in_progress') {
    return <Loader2 size={14} className="yolo-todo-panel__icon-spin" />
  }
  return <Circle size={14} />
}
