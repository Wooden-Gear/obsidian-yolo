import React, { useState } from 'react'
import { App, Notice } from 'obsidian'

import SmartComposerPlugin from '../../../main'
import { ChatModel } from '../../../types/chat-model.types'
import { useLanguage } from '../../../contexts/language-context'
import { ObsidianButton } from '../../common/ObsidianButton'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianTextInput } from '../../common/ObsidianTextInput'
import { ReactModal } from '../../common/ReactModal'

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
    id: string
    model: string
  }>({
    id: model.id,
    model: model.model,
  })

  const handleSubmit = async () => {
    if (!formData.id.trim() || !formData.model.trim()) {
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

      // Check if new ID already exists (and it's not the current model)
      if (formData.id !== model.id && chatModels.some(m => m.id === formData.id)) {
        new Notice('Model ID already exists')
        return
      }

      // Update the model
      chatModels[modelIndex] = {
        ...chatModels[modelIndex],
        id: formData.id,
        model: formData.model,
      }

      await plugin.setSettings({
        ...settings,
        chatModels,
      })

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
          value={formData.id}
          placeholder={t('settings.models.modelIdPlaceholder')}
          onChange={(value: string) =>
            setFormData((prev) => ({ ...prev, id: value }))
          }
        />
      </ObsidianSetting>

      <ObsidianSetting name={t('settings.models.modelName')} required>
        <ObsidianTextInput
          value={formData.model}
          placeholder={t('settings.models.modelNamePlaceholder')}
          onChange={(value: string) =>
            setFormData((prev) => ({ ...prev, model: value }))
          }
        />
      </ObsidianSetting>

      

      <ObsidianSetting>
        <ObsidianButton text={t('common.save')} onClick={handleSubmit} cta />
        <ObsidianButton text={t('common.cancel')} onClick={onClose} />
      </ObsidianSetting>
    </>
  )
}
