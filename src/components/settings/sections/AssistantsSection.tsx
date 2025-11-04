import { Plus, Trash2 } from 'lucide-react'
import { App } from 'obsidian'
import React, { useState } from 'react'

import { useLanguage } from '../../../contexts/language-context'
import { useSettings } from '../../../contexts/settings-context'
import { Assistant } from '../../../types/assistant.types'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianTextArea } from '../../common/ObsidianTextArea'
import { ObsidianTextInput } from '../../common/ObsidianTextInput'
import { ConfirmModal } from '../../modals/ConfirmModal'

type AssistantItemProps = {
  assistant: Assistant
  onUpdate: (updatedAssistant: Assistant) => void
  onDelete: (id: string) => void
}

function AssistantItem({ assistant, onUpdate, onDelete }: AssistantItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { t } = useLanguage()

  const handleDeleteClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    onDelete(assistant.id)
  }

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <div className={`smtcmp-assistant-item${isExpanded ? ' expanded' : ''}`}>
      <div
        className="smtcmp-assistant-header"
        onClick={handleToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleToggleExpand()
        }}
        aria-expanded={isExpanded}
        aria-controls={`assistant-details-${assistant.id}`}
      >
        <div className="smtcmp-assistant-header-info">
          <div className="smtcmp-assistant-header-info-row">
            <div className="smtcmp-assistant-name">{assistant.name}</div>
          </div>
        </div>

        <div className="smtcmp-assistant-actions">
          <button
            className="smtcmp-delete-assistant-btn"
            aria-label={`${t('settings.assistants.deleteAssistantAria', 'Delete assistant')} ${assistant.name}`}
            onClick={handleDeleteClick}
          >
            <Trash2 size={16} />
          </button>

          <span className="smtcmp-assistant-expand-icon">▼</span>
        </div>
      </div>

      {isExpanded && (
        <div
          className="smtcmp-assistant-details"
          id={`assistant-details-${assistant.id}`}
        >
          <div className="smtcmp-assistant-field">
            <label className="smtcmp-assistant-field-label">
              {t('settings.assistants.name', 'Name')}
            </label>
            <ObsidianTextInput
              value={assistant.name}
              onChange={(value) => onUpdate({ ...assistant, name: value })}
              placeholder={t(
                'settings.assistants.namePlaceholder',
                'Enter assistant name',
              )}
            />
          </div>

          <ObsidianSetting
            name={t('settings.assistants.systemPrompt', 'System Prompt')}
            desc={t(
              'settings.assistants.systemPromptDesc',
              'This prompt will be added to the beginning of every chat.',
            )}
            className="smtcmp-settings-textarea-header"
          />

          <ObsidianSetting className="smtcmp-settings-textarea">
            <ObsidianTextArea
              value={assistant.systemPrompt || ''}
              onChange={(value) =>
                onUpdate({ ...assistant, systemPrompt: value })
              }
              placeholder={t(
                'settings.assistants.systemPromptPlaceholder',
                "Enter system prompt to define assistant's behavior and capabilities",
              )}
            />
          </ObsidianSetting>
        </div>
      )}
    </div>
  )
}

type AssistantsSectionProps = {
  app: App
}

export function AssistantsSection({ app }: AssistantsSectionProps) {
  const { settings, setSettings } = useSettings()
  const { t } = useLanguage()
  const assistants = settings.assistants || []

  const handleAddAssistant = async () => {
    const newAssistant: Assistant = {
      id: crypto.randomUUID(),
      name: `${t('settings.assistants.defaultAssistantName', 'New Assistant')} ${assistants.length + 1}`,
      description: '',
      systemPrompt: '',
    }

    const newAssistantsList = [...assistants, newAssistant]

    await setSettings({
      ...settings,
      assistants: newAssistantsList,
    })
  }

  const handleUpdateAssistant = async (updatedAssistant: Assistant) => {
    const newAssistantsList = assistants.map((assistant: Assistant) =>
      assistant.id === updatedAssistant.id ? updatedAssistant : assistant,
    )

    await setSettings({
      ...settings,
      assistants: newAssistantsList,
    })
  }

  const handleDeleteAssistant = (id: string) => {
    const assistantToDelete = assistants.find((a) => a.id === id)
    if (!assistantToDelete) return

    let confirmed = false

    const modal = new ConfirmModal(app, {
      title: t(
        'settings.assistants.deleteConfirmTitle',
        'Confirm Delete Assistant',
      ),
      message: `${t('settings.assistants.deleteConfirmMessagePrefix', 'Are you sure you want to delete assistant')} "${assistantToDelete.name}"${t('settings.assistants.deleteConfirmMessageSuffix', '? This action cannot be undone.')}`,
      ctaText: t('common.delete'),
      onConfirm: () => {
        confirmed = true
      },
    })

    modal.onClose = async () => {
      if (confirmed) {
        const updatedAssistants = assistants.filter((a) => a.id !== id)

        let newCurrentAssistantId = settings.currentAssistantId
        if (id === settings.currentAssistantId) {
          newCurrentAssistantId =
            updatedAssistants.length > 0 ? updatedAssistants[0].id : undefined
        }

        await setSettings({
          ...settings,
          assistants: updatedAssistants,
          currentAssistantId: newCurrentAssistantId,
        })
      }
    }

    modal.open()
  }

  return (
    <div className="smtcmp-settings-section">
      <div className="smtcmp-settings-header-row">
        <div className="smtcmp-settings-header">
          {t('settings.assistants.title')}
        </div>
        <button
          onClick={handleAddAssistant}
          aria-label={t(
            'settings.assistants.addAssistantAria',
            'Add new assistant',
          )}
          className="smtcmp-add-assistant-btn"
        >
          <Plus size={16} />
          {t('settings.assistants.addAssistant')}
        </button>
      </div>

      <ObsidianSetting desc={t('settings.assistants.desc')} />

      {assistants.length === 0 ? (
        <div className="smtcmp-no-assistants">
          <p className="smtcmp-no-assistants-text">
            {t('settings.assistants.noAssistants')}
          </p>
        </div>
      ) : (
        <div className="smtcmp-assistants-list">
          {assistants.map((assistant: Assistant) => (
            <AssistantItem
              key={assistant.id}
              assistant={assistant}
              onUpdate={handleUpdateAssistant}
              onDelete={handleDeleteAssistant}
            />
          ))}
        </div>
      )}
    </div>
  )
}
