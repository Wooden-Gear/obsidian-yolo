import { App, Notice } from 'obsidian'
import React, { useState } from 'react'

import { useLanguage } from '../../../contexts/language-context'
import SmartComposerPlugin from '../../../main'
import { EmbeddingModel } from '../../../types/embedding-model.types'
import { ObsidianButton } from '../../common/ObsidianButton'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianTextInput } from '../../common/ObsidianTextInput'
import { ReactModal } from '../../common/ReactModal'

type EditEmbeddingModelModalComponentProps = {
  plugin: SmartComposerPlugin
  onClose: () => void
  model: EmbeddingModel
}

export class EditEmbeddingModelModal extends ReactModal<EditEmbeddingModelModalComponentProps> {
  constructor(app: App, plugin: SmartComposerPlugin, model: EmbeddingModel) {
    super({
      app: app,
      Component: EditEmbeddingModelModalComponent,
      props: { plugin, model },
      options: {
        title: 'Edit Custom Embedding Model', // Will be translated in component
      },
      plugin: plugin,
    })
  }
}

function EditEmbeddingModelModalComponent({
  plugin,
  onClose,
  model,
}: EditEmbeddingModelModalComponentProps) {
  const { t } = useLanguage()

  // Update modal title
  React.useEffect(() => {
    const modalEl = document.querySelector('.modal .modal-title')
    if (modalEl) {
      modalEl.textContent = t('settings.models.editCustomEmbeddingModel')
    }
  }, [t])
  const [formData, setFormData] = useState<{
    id: string
    model: string
    dimension: string
  }>({
    id: model.id,
    model: model.model,
    dimension: model.dimension?.toString() || '',
  })

  const handleSubmit = async () => {
    if (!formData.id.trim() || !formData.model.trim()) {
      new Notice(t('common.error'))
      return
    }

    const dimension = formData.dimension
      ? parseInt(formData.dimension)
      : undefined
    if (formData.dimension && (isNaN(dimension!) || dimension! <= 0)) {
      new Notice('Invalid dimension value')
      return
    }

    try {
      const settings = plugin.settings
      const embeddingModels = [...settings.embeddingModels]
      const modelIndex = embeddingModels.findIndex((m) => m.id === model.id)

      if (modelIndex === -1) {
        new Notice('Model not found')
        return
      }

      // Check if new ID already exists (and it's not the current model)
      if (
        formData.id !== model.id &&
        embeddingModels.some((m) => m.id === formData.id)
      ) {
        new Notice('Model ID already exists')
        return
      }

      // Update the model
      embeddingModels[modelIndex] = {
        ...embeddingModels[modelIndex],
        id: formData.id,
        model: formData.model,
        dimension: dimension!,
      }

      await plugin.setSettings({
        ...settings,
        embeddingModels,
      })

      new Notice(t('common.success'))
      onClose()
    } catch (error) {
      console.error('Failed to update embedding model:', error)
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

      <ObsidianSetting
        name={t('settings.models.dimension')}
        desc={t('settings.models.dimensionDesc')}
      >
        <ObsidianTextInput
          value={formData.dimension}
          placeholder={t('settings.models.dimensionPlaceholder')}
          onChange={(value: string) =>
            setFormData((prev) => ({ ...prev, dimension: value }))
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
