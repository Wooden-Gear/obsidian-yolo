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
    name: string | undefined
    dimension: string
  }>({
    id: model.id,
    model: model.model,
    name: (model as any).name,
    dimension: model.dimension?.toString() || '',
  })

  const handleSubmit = async () => {
    if (!formData.model.trim()) {
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

      // Update the model (keep the original ID, don't allow editing it for existing models)
      embeddingModels[modelIndex] = {
        ...embeddingModels[modelIndex],
        model: formData.model,
        name:
          formData.name && formData.name.trim().length > 0
            ? formData.name
            : formData.model,
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
      {/* Display name */}
      <ObsidianSetting name={t('settings.models.modelName')}>
        <ObsidianTextInput
          value={formData.name ?? ''}
          placeholder={t('settings.models.modelNamePlaceholder')}
          onChange={(value: string) =>
            setFormData((prev) => ({ ...prev, name: value }))
          }
        />
      </ObsidianSetting>

      {/* Model calling ID */}
      <ObsidianSetting
        name={t('settings.models.modelId')}
        desc={t('settings.models.modelIdDesc')}
        required
      >
        <ObsidianTextInput
          value={formData.model}
          placeholder={t('settings.models.modelIdPlaceholder')}
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
