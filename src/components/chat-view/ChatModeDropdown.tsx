import * as Popover from '@radix-ui/react-popover'
import React, { useCallback, useEffect, useState } from 'react'
import { useLanguage } from '../../contexts/language-context'

export function ChatModeDropdown({
  mode,
  onChange,
  children,
}: {
  mode: 'rag' | 'brute'
  onChange: (m: 'rag' | 'brute') => void
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
            {[
              { key: 'rag', label: t('chat.modeRAG') ?? 'RAG' },
              { key: 'brute', label: t('chat.modeBrute') ?? 'Brute' },
            ].map((item, index) => (
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
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

