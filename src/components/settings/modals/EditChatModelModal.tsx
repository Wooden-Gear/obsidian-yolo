import React, { useState } from 'react'
import { App, Notice } from 'obsidian'

import SmartComposerPlugin from '../../../main'
import { ChatModel } from '../../../types/chat-model.types'
import { useLanguage } from '../../../contexts/language-context'
import { ObsidianButton } from '../../common/ObsidianButton'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianTextInput } from '../../common/ObsidianTextInput'
import { ObsidianDropdown } from '../../common/ObsidianDropdown'
import { ReactModal } from '../../common/ReactModal'
import { generateModelId, detectReasoningTypeFromModelId, ensureUniqueModelId } from '../../../utils/model-id-utils'

interface EditChatModelModalComponentProps {
  plugin: SmartComposerPlugin
  onClose: () => void
  model: ChatModel
}

export class EditChatModelModal extends ReactModal<EditChatModelModalComponentProps> {
  constructor(app: App, plugin: SmartComposerPlugin, model: ChatModel) {
    super({
      app: app,
      Component: EditChatModelModalComponent,
      props: { plugin, model },
      options: {
        title: 'Edit Custom Chat Model', // Will be translated in component
      },
      plugin: plugin,
    })
  }
}

function EditChatModelModalComponent({
  plugin,
  onClose,
  model,
}: EditChatModelModalComponentProps) {
  const { t } = useLanguage()
  
  // Update modal title
  React.useEffect(() => {
    const modalEl = document.querySelector('.modal .modal-title')
    if (modalEl) {
      modalEl.textContent = t('settings.models.editCustomChatModel')
    }
  }, [t])
  const [formData, setFormData] = useState<{
    model: string
    name: string
  }>({
    model: model.model,
    name: model.name ?? '',
  })

  // Reasoning UI states
  const [reasoningType, setReasoningType] = useState<'none' | 'openai' | 'gemini'>(() => {
    if ((model as any).reasoning?.enabled) return 'openai'
    if ((model as any).thinking?.enabled) return 'gemini'
    return 'none'
  })
  // If user changes dropdown manually, disable auto detection
  const [autoDetectReasoning, setAutoDetectReasoning] = useState<boolean>(true)
  const [openaiEffort, setOpenaiEffort] = useState<'minimal' | 'low' | 'medium' | 'high'>(
    ((model as any).reasoning?.reasoning_effort as any) || 'medium',
  )
  const [geminiBudget, setGeminiBudget] = useState<string>(
    `${(model as any).thinking?.thinking_budget ?? 2048}`,
  )

  const handleSubmit = async () => {
    if (!formData.model.trim()) {
      new Notice(t('common.error'))
      return
    }

    try {
      const settings = plugin.settings
      const chatModels = [...settings.chatModels]
      const modelIndex = chatModels.findIndex(m => m.id === model.id)
      
      if (modelIndex === -1) {
        new Notice('Model not found')
        return
      }

      // Compute new internal id from provider + API model id (calling ID)
      const baseInternalId = generateModelId(model.providerId, formData.model)
      const existingIds = chatModels.map(m => m.id).filter(id => id !== model.id)
      const newInternalId = ensureUniqueModelId(existingIds, baseInternalId)

      // Compose reasoning/thinking fields based on selection and provider
      const updatedModel = {
        ...chatModels[modelIndex],
        id: newInternalId,
        model: formData.model,
        name: formData.name && formData.name.trim().length > 0 ? formData.name : undefined,
      } as any

      // Apply according to selected reasoningType only (not limited by providerType)
      if (reasoningType === 'openai') {
        updatedModel.reasoning = { enabled: true, reasoning_effort: openaiEffort }
        delete updatedModel.thinking
      } else if (reasoningType === 'gemini') {
        const budget = parseInt(geminiBudget, 10)
        if (Number.isNaN(budget)) {
          new Notice(t('common.error'))
          return
        }
        updatedModel.thinking = { enabled: true, thinking_budget: budget }
        delete updatedModel.reasoning
      } else {
        delete updatedModel.reasoning
        delete updatedModel.thinking
      }

      // Update the model
      chatModels[modelIndex] = updatedModel

      // Update references if current selection points to the old id
      const nextSettings = { ...settings, chatModels }
      if (nextSettings.chatModelId === model.id) {
        nextSettings.chatModelId = newInternalId
      }
      if (nextSettings.applyModelId === model.id) {
        nextSettings.applyModelId = newInternalId
      }

      await plugin.setSettings(nextSettings)

      new Notice(t('common.success'))
      onClose()
    } catch (error) {
      console.error('Failed to update chat model:', error)
      new Notice(t('common.error'))
    }
  }

  return (
    <>
      <ObsidianSetting
        name={t('settings.models.modelId')}
        desc={t('settings.models.modelIdDesc')}
        required
      >
        <ObsidianTextInput
          value={formData.model}
          placeholder={t('settings.models.modelIdPlaceholder')}
          onChange={(value: string) => {
            setFormData((prev) => ({ ...prev, model: value }))
            if (autoDetectReasoning) {
              const detected = detectReasoningTypeFromModelId(value)
              setReasoningType(detected)
            }
          }}
        />
      </ObsidianSetting>

      {/* Display name (move right below modelId) */}
      <ObsidianSetting name={t('settings.models.modelName')}>
        <ObsidianTextInput
          value={formData.name}
          placeholder={t('settings.models.modelNamePlaceholder')}
          onChange={(value: string) =>
            setFormData((prev) => ({ ...prev, name: value }))
          }
        />
      </ObsidianSetting>

      {/* Reasoning type */}
      <ObsidianSetting name={t('settings.models.reasoningType')}>
        <ObsidianDropdown
          value={reasoningType}
          options={{
            none: t('settings.models.reasoningTypeNone'),
            openai: t('settings.models.reasoningTypeOpenAI'),
            gemini: t('settings.models.reasoningTypeGemini'),
          }}
          onChange={(v: string) => {
            setReasoningType(v as any)
            setAutoDetectReasoning(false)
          }}
        />
      </ObsidianSetting>

      {/* OpenAI reasoning options */}
      {(reasoningType === 'openai') && (
        <ObsidianSetting
          name={t('settings.models.openaiReasoningEffort')}
          desc={t('settings.models.openaiReasoningEffortDesc')}
        >
          <ObsidianDropdown
            value={openaiEffort}
            options={{ minimal: 'minimal', low: 'low', medium: 'medium', high: 'high' }}
            onChange={(v: string) => setOpenaiEffort(v as any)}
          />
        </ObsidianSetting>
      )}

      {/* Gemini thinking options */}
      {(reasoningType === 'gemini') && (
        <ObsidianSetting
          name={t('settings.models.geminiThinkingBudget')}
          desc={t('settings.models.geminiThinkingBudgetDesc')}
        >
          <ObsidianTextInput
            value={geminiBudget}
            placeholder={t('settings.models.geminiThinkingBudgetPlaceholder')}
            onChange={(v: string) => setGeminiBudget(v)}
          />
        </ObsidianSetting>
      )}

      

      <ObsidianSetting>
        <ObsidianButton text={t('common.save')} onClick={handleSubmit} cta />
        <ObsidianButton text={t('common.cancel')} onClick={onClose} />
      </ObsidianSetting>
    </>
  )
}
