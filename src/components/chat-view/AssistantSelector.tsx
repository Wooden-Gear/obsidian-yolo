import * as Popover from '@radix-ui/react-popover'
import { ChevronDown, ChevronUp } from 'lucide-react'
import React, { useState } from 'react'

import { useLanguage } from '../../contexts/language-context'
import { useSettings } from '../../contexts/settings-context'
import { Assistant } from '../../types/assistant.types'
import { renderAssistantIcon } from '../../utils/assistant-icon'

export function AssistantSelector() {
  const { settings, setSettings } = useSettings()
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)

  // Get assistant list and currently selected assistant
  const assistants = settings.assistants || []
  const currentAssistantId = settings.currentAssistantId

  // Get the current assistant object
  const currentAssistant = assistants.find((a) => a.id === currentAssistantId)

  // Handler function for selecting an assistant
  const handleSelectAssistant = (assistant: Assistant) => {
    void (async () => {
      try {
        await setSettings({
          ...settings,
          currentAssistantId: assistant.id,
        })
        setOpen(false)
      } catch (error: unknown) {
        console.error('Failed to select assistant', error)
      }
    })()
  }

  // Handler function for selecting "no assistant"
  const handleSelectNoAssistant = () => {
    void (async () => {
      try {
        await setSettings({
          ...settings,
          currentAssistantId: undefined,
        })
        setOpen(false)
      } catch (error: unknown) {
        console.error('Failed to clear assistant selection', error)
      }
    })()
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="smtcmp-assistant-selector-button"
          data-state={open ? 'open' : 'closed'}
        >
          {currentAssistant && (
            <div className="smtcmp-assistant-selector-current-icon">
              {renderAssistantIcon(currentAssistant.icon, 14)}
            </div>
          )}
          <div className="smtcmp-assistant-selector-current">
            {currentAssistant
              ? currentAssistant.name
              : t('settings.assistants.noAssistant')}
          </div>
          <div className="smtcmp-assistant-selector-icon">
            {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </div>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="smtcmp-popover smtcmp-chat-sidebar-popover smtcmp-assistant-selector-content"
          sideOffset={14}
        >
          <ul className="smtcmp-assistant-selector-list smtcmp-model-select-list">
            {/* "No Assistant" option */}
            <li
              className={`smtcmp-assistant-selector-item ${
                !currentAssistantId ? 'selected' : ''
              }`}
              onClick={handleSelectNoAssistant}
            >
              <div className="smtcmp-assistant-selector-item-content">
                <div className="smtcmp-assistant-selector-item-name">
                  {t('settings.assistants.noAssistant')}
                </div>
              </div>
            </li>

            {/* Available assistants */}
            {assistants.map((assistant) => (
              <li
                key={assistant.id}
                className={`smtcmp-assistant-selector-item ${
                  assistant.id === currentAssistantId ? 'selected' : ''
                }`}
                onClick={() => handleSelectAssistant(assistant)}
              >
                <div className="smtcmp-assistant-selector-item-icon">
                  {renderAssistantIcon(assistant.icon, 14)}
                </div>
                <div className="smtcmp-assistant-selector-item-content">
                  <div className="smtcmp-assistant-selector-item-name">
                    {assistant.name}
                  </div>
                  {assistant.description && (
                    <div className="smtcmp-assistant-selector-item-description">
                      {assistant.description}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
