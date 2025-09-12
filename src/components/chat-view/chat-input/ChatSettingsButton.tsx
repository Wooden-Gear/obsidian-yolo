import * as Popover from '@radix-ui/react-popover'
import { SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { ConversationOverrideSettings } from '../../../types/conversation-settings.types'

export default function ChatSettingsButton({
  overrides,
  onChange,
}: {
  overrides?: ConversationOverrideSettings
  onChange?: (overrides: ConversationOverrideSettings) => void
}) {
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
        <button ref={triggerRef} className="clickable-icon" aria-label="Conversation settings">
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
            <div className="smtcmp-chat-settings-section-title">Chat Memory</div>
            <div className="smtcmp-chat-settings-row2">
              <div className="smtcmp-chat-settings-label">Max Context</div>
              <input
                type="number"
                className="smtcmp-chat-settings-input smtcmp-number-pill"
                min={0}
                max={256}
                step={1}
                placeholder="Default"
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
            <div className="smtcmp-chat-settings-section-title">Sampling Parameters</div>
            <div className="smtcmp-chat-settings-row2">
              <div className="smtcmp-chat-settings-label">Temperature</div>
              <input
                type="number"
                className="smtcmp-chat-settings-input smtcmp-number-pill"
                min={0}
                max={2}
                step={0.1}
                placeholder="Default"
                value={value.temperature ?? ''}
                onChange={(e) =>
                  update({ temperature: e.currentTarget.value === '' ? null : Number(e.currentTarget.value) })
                }
              />
            </div>

            <div className="smtcmp-chat-settings-row2">
              <div className="smtcmp-chat-settings-label">Top P</div>
              <input
                type="number"
                className="smtcmp-chat-settings-input smtcmp-number-pill"
                min={0}
                max={1}
                step={0.01}
                placeholder="Default"
                value={value.top_p ?? ''}
                onChange={(e) =>
                  update({ top_p: e.currentTarget.value === '' ? null : Number(e.currentTarget.value) })
                }
              />
            </div>

            <div className="smtcmp-chat-settings-row-inline">
              <div className="smtcmp-chat-settings-label">Streaming</div>
              <div className="smtcmp-segmented">
                <button
                  className={value.stream === null || value.stream === undefined ? 'active' : ''}
                  onClick={() => update({ stream: null })}
                >
                  Default
                </button>
                <button
                  className={value.stream === true ? 'active' : ''}
                  onClick={() => update({ stream: true })}
                >
                  On
                </button>
                <button
                  className={value.stream === false ? 'active' : ''}
                  onClick={() => update({ stream: false })}
                >
                  Off
                </button>
              </div>
            </div>
          </div>
        </div>
      </Popover.Content>
    </Popover.Root>
  )
}
