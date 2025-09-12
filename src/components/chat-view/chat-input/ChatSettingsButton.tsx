import * as Popover from '@radix-ui/react-popover'
import { SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { ConversationOverrideSettings } from '../../../types/conversation-settings.types'
import { useLanguage } from '../../../contexts/language-context'

export default function ChatSettingsButton({
  overrides,
  onChange,
}: {
  overrides?: ConversationOverrideSettings
  onChange?: (overrides: ConversationOverrideSettings) => void
}) {
  const { t } = useLanguage()
  const value = useMemo<ConversationOverrideSettings>(() => {
    return {
      temperature: overrides?.temperature ?? null,
      top_p: overrides?.top_p ?? null,
      maxContextMessages: overrides?.maxContextMessages ?? null,
      stream: overrides?.stream ?? null,
    }
  }, [overrides])

  const update = (patch: Partial<ConversationOverrideSettings>) => {
    const next = { ...value, ...patch }
    onChange?.(next)
  }

  // Measure input wrapper width to set popover width = 50% of it (with a min width)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [panelWidth, setPanelWidth] = useState<number | undefined>(undefined)
  useEffect(() => {
    const btn = triggerRef.current
    if (!btn) return
    const wrapper = btn.closest('.smtcmp-chat-input-wrapper') as HTMLElement | null
    if (!wrapper) return

    const MIN_WIDTH = 320
    const compute = () => {
      const w = wrapper.clientWidth
      setPanelWidth(Math.max(MIN_WIDTH, Math.floor(w / 2)))
    }
    compute()

    const onResize = () => compute()

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(onResize)
      ro.observe(wrapper)
      return () => ro.disconnect()
    } else {
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button ref={triggerRef} className="clickable-icon" aria-label={t('chat.conversationSettings.openAria', 'Conversation settings')}>
          <SlidersHorizontal size={14} />
        </button>
      </Popover.Trigger>
      <Popover.Content
        className="smtcmp-popover-content smtcmp-chat-settings-content"
        side="bottom"
        align="end"
        sideOffset={6}
        style={{ width: panelWidth }}
      >
        <div className="smtcmp-chat-settings">
          <div className="smtcmp-chat-settings-section">
            <div className="smtcmp-chat-settings-section-title">{t('chat.conversationSettings.chatMemory', 'Chat Memory')}</div>
            <div className="smtcmp-chat-settings-row2">
              <div className="smtcmp-chat-settings-label">{t('chat.conversationSettings.maxContext', 'Max Context')}</div>
              <input
                type="number"
                className="smtcmp-chat-settings-input smtcmp-number-pill"
                min={0}
                max={256}
                step={1}
                placeholder={t('common.default', 'Default')}
                value={value.maxContextMessages ?? ''}
                onChange={(e) =>
                  update({
                    maxContextMessages: e.currentTarget.value === '' ? null : Number(e.currentTarget.value),
                  })
                }
              />
            </div>
          </div>

          <div className="smtcmp-chat-settings-section">
            <div className="smtcmp-chat-settings-section-title">{t('chat.conversationSettings.sampling', 'Sampling Parameters')}</div>
            <div className="smtcmp-chat-settings-row2">
              <div className="smtcmp-chat-settings-label">{t('chat.conversationSettings.temperature', 'Temperature')}</div>
              <input
                type="number"
                className="smtcmp-chat-settings-input smtcmp-number-pill"
                min={0}
                max={2}
                step={0.1}
                placeholder={t('common.default', 'Default')}
                value={value.temperature ?? ''}
                onChange={(e) =>
                  update({ temperature: e.currentTarget.value === '' ? null : Number(e.currentTarget.value) })
                }
              />
            </div>

            <div className="smtcmp-chat-settings-row2">
              <div className="smtcmp-chat-settings-label">{t('chat.conversationSettings.topP', 'Top P')}</div>
              <input
                type="number"
                className="smtcmp-chat-settings-input smtcmp-number-pill"
                min={0}
                max={1}
                step={0.01}
                placeholder={t('common.default', 'Default')}
                value={value.top_p ?? ''}
                onChange={(e) =>
                  update({ top_p: e.currentTarget.value === '' ? null : Number(e.currentTarget.value) })
                }
              />
            </div>

            <div className="smtcmp-chat-settings-row-inline">
              <div className="smtcmp-chat-settings-label">{t('chat.conversationSettings.streaming', 'Streaming')}</div>
              <div className="smtcmp-segmented">
                <button
                  className={value.stream === null || value.stream === undefined ? 'active' : ''}
                  onClick={() => update({ stream: null })}
                >
                  {t('common.default', 'Default')}
                </button>
                <button
                  className={value.stream === true ? 'active' : ''}
                  onClick={() => update({ stream: true })}
                >
                  {t('common.on', 'On')}
                </button>
                <button
                  className={value.stream === false ? 'active' : ''}
                  onClick={() => update({ stream: false })}
                >
                  {t('common.off', 'Off')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Popover.Content>
    </Popover.Root>
  )
}
