import * as Popover from '@radix-ui/react-popover'
import { SlidersHorizontal } from 'lucide-react'
import { useMemo } from 'react'

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

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="clickable-icon" aria-label="Conversation settings">
          <SlidersHorizontal size={14} />
        </button>
      </Popover.Trigger>
      <Popover.Content className="smtcmp-popover-content smtcmp-chat-settings-content" side="bottom" align="end" sideOffset={6}>
        <div className="smtcmp-chat-settings-grid">
          <div className="smtcmp-chat-settings-row">
            <div className="smtcmp-chat-settings-label">Temperature</div>
            <input
              type="number"
              className="smtcmp-chat-settings-input"
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
          <div className="smtcmp-chat-settings-row">
            <div className="smtcmp-chat-settings-label">Top P</div>
            <input
              type="number"
              className="smtcmp-chat-settings-input"
              min={0}
              max={1}
              step={0.05}
              placeholder="Default"
              value={value.top_p ?? ''}
              onChange={(e) =>
                update({ top_p: e.currentTarget.value === '' ? null : Number(e.currentTarget.value) })
              }
            />
          </div>
          <div className="smtcmp-chat-settings-row">
            <div className="smtcmp-chat-settings-label">Context</div>
            <input
              type="number"
              className="smtcmp-chat-settings-input"
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
          <div className="smtcmp-chat-settings-row">
            <div className="smtcmp-chat-settings-label">Streaming</div>
            <select
              className="smtcmp-chat-settings-input"
              value={value.stream === null || value.stream === undefined ? '' : value.stream ? 'on' : 'off'}
              onChange={(e) =>
                update({
                  stream: e.currentTarget.value === '' ? null : e.currentTarget.value === 'on',
                })
              }
            >
              <option value="">Default</option>
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </div>
        </div>
      </Popover.Content>
    </Popover.Root>
  )
}
