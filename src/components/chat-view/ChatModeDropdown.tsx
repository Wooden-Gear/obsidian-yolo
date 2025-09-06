import * as Popover from '@radix-ui/react-popover'
import React, { useCallback, useEffect, useState } from 'react'
import { useLanguage } from '../../contexts/language-context'

export function ChatModeDropdown({
  mode,
  onChange,
  showBruteOption = true,
  learningEnabled,
  onToggleLearning,
  children,
}: {
  mode: 'rag' | 'brute'
  onChange: (m: 'rag' | 'brute') => void
  showBruteOption?: boolean
  learningEnabled: boolean
  onToggleLearning: (enabled: boolean) => void
  children: React.ReactNode
}) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState<number>(
    mode === 'rag' ? 0 : 1,
  )

  useEffect(() => {
    setFocusedIndex(mode === 'rag' ? 0 : 1)
  }, [mode])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        setFocusedIndex(Math.max(0, focusedIndex - 1))
      } else if (e.key === 'ArrowDown') {
        setFocusedIndex(Math.min(1, focusedIndex + 1))
      } else if (e.key === 'Enter') {
        onChange(focusedIndex === 0 ? 'rag' : 'brute')
        setOpen(false)
      }
    },
    [focusedIndex, onChange],
  )

  const modeItems = [
    { key: 'rag', label: t('chat.modeRAG') ?? 'RAG' },
    ...(showBruteOption ? [{ key: 'brute', label: t('chat.modeBrute') ?? 'Brute' }] : []),
  ] as const

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="clickable-icon" aria-label={t('chat.modeTitle') ?? 'Chat mode'}>
          {children}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="smtcmp-popover smtcmp-chat-mode-dropdown-content"
          onKeyDown={handleKeyDown}
        >
          <ul>
            {modeItems.map((item, index) => (
              <li
                key={item.key}
                className={
                  (mode === item.key ? 'selected ' : '') +
                  (focusedIndex === index ? 'focused' : '')
                }
                onMouseEnter={() => setFocusedIndex(index)}
                onClick={() => {
                  onChange(item.key as 'rag' | 'brute')
                  setOpen(false)
                }}
              >
                {item.label}
              </li>
            ))}
            <li className="smtcmp-divider" aria-hidden="true" />
            <li
              onClick={() => {
                onToggleLearning(!learningEnabled)
                setOpen(false)
              }}
              className={learningEnabled ? 'selected' : ''}
              aria-checked={learningEnabled}
              role="menuitemcheckbox"
            >
              {t('chat.modeLearning') ?? 'Learning mode'}
            </li>
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
