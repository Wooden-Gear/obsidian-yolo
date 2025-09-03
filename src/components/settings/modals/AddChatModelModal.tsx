import { App, Notice } from 'obsidian'
import { useState } from 'react'

import { DEFAULT_PROVIDERS } from '../../../constants'
import { useLanguage } from '../../../contexts/language-context'
import SmartComposerPlugin from '../../../main'
import { ChatModel, chatModelSchema } from '../../../types/chat-model.types'
import { PromptLevel } from '../../../types/prompt-level.types'
import { LLMProvider } from '../../../types/provider.types'
import { generateModelId } from '../../../utils/model-id-utils'
import { ObsidianButton } from '../../common/ObsidianButton'
import { ObsidianDropdown } from '../../common/ObsidianDropdown'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianTextInput } from '../../common/ObsidianTextInput'
import { ReactModal } from '../../common/ReactModal'

type AddChatModelModalComponentProps = {
  plugin: SmartComposerPlugin
  onClose: () => void
  provider?: LLMProvider
}

export class AddChatModelModal extends ReactModal<AddChatModelModalComponentProps> {
  constructor(app: App, plugin: SmartComposerPlugin, provider?: LLMProvider) {
    super({
      app: app,
      Component: AddChatModelModalComponent,
      props: { plugin, provider },
      options: {
        title: 'Add Custom Chat Model', // Will be translated in component
      },
      plugin: plugin,
    })
  }
}

function AddChatModelModalComponent({
  plugin,
  onClose,
  provider,
}: AddChatModelModalComponentProps) {
  const { t } = useLanguage()
  const selectedProvider: LLMProvider | undefined = provider ?? plugin.settings.providers[0]
  const initialProviderId = selectedProvider?.id ?? DEFAULT_PROVIDERS[0].id
  const initialProviderType = selectedProvider?.type ?? DEFAULT_PROVIDERS[0].type
  const [formData, setFormData] = useState<ChatModel>({
    providerId: initialProviderId,
    providerType: initialProviderType,
    id: '',
    model: '',
    promptLevel: PromptLevel.Default,
  })

  const handleSubmit = async () => {
    // Generate model ID with provider prefix
    const modelIdWithPrefix = generateModelId(formData.providerId, formData.id)
    const modelDataWithPrefix = {
      ...formData,
      id: modelIdWithPrefix,
    }

    if (plugin.settings.chatModels.some((p) => p.id === modelIdWithPrefix)) {
      new Notice('Model with this ID already exists. Try a different ID.')
      return
    }

    if (
      !plugin.settings.providers.some(
        (provider) => provider.id === formData.providerId,
      )
    ) {
      new Notice('Provider with this ID does not exist')
      return
    }

    const validationResult = chatModelSchema.safeParse(modelDataWithPrefix)
    if (!validationResult.success) {
      new Notice(validationResult.error.issues.map((v) => v.message).join('\n'))
      return
    }

    await plugin.setSettings({
      ...plugin.settings,
      chatModels: [...plugin.settings.chatModels, modelDataWithPrefix],
    })

    onClose()
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

      {/* Provider is derived from the current group context; field removed intentionally */}

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
        name={t('settings.models.promptLevel')}
        desc={t('settings.models.promptLevelDesc')}
        required
      >
        <ObsidianDropdown
          value={(formData.promptLevel ?? PromptLevel.Default).toString()}
          options={{
            [PromptLevel.Default]: t('settings.models.promptLevelDefault'),
            [PromptLevel.Simple]: t('settings.models.promptLevelSimple'),
          }}
          onChange={(value: string) =>
            setFormData((prev) => ({
              ...prev,
              promptLevel: Number(value) as PromptLevel,
            }))
          }
        />
      </ObsidianSetting>

      <ObsidianSetting>
        <ObsidianButton text={t('common.add')} onClick={handleSubmit} cta />
        <ObsidianButton text={t('common.cancel')} onClick={onClose} />
      </ObsidianSetting>
    </>
  )
}
