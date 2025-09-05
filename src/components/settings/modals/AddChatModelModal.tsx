import { App, Notice } from 'obsidian'
import { useEffect, useState } from 'react'

import { DEFAULT_PROVIDERS } from '../../../constants'
import { useLanguage } from '../../../contexts/language-context'
import SmartComposerPlugin from '../../../main'
import { ChatModel, chatModelSchema } from '../../../types/chat-model.types'
import { LLMProvider } from '../../../types/provider.types'
import { generateModelId } from '../../../utils/model-id-utils'
import { ObsidianButton } from '../../common/ObsidianButton'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianTextInput } from '../../common/ObsidianTextInput'
import { ObsidianDropdown } from '../../common/ObsidianDropdown'
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
  })

  // Auto-fetch available models via OpenAI-compatible GET /v1/models
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState<boolean>(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const fetchModels = async () => {
      if (!selectedProvider) return
      // Only attempt for providers that follow OpenAI-compatible /v1/models
      const isOpenAIStyle =
        selectedProvider.type === 'openai' ||
        selectedProvider.type === 'openai-compatible'

      if (!isOpenAIStyle) return

      setLoadingModels(true)
      setLoadError(null)
      try {
        const base = ((): string => {
          // default OpenAI base when not provided
          const cleaned = selectedProvider.baseUrl?.replace(/\/+$/, '')
          if (cleaned && cleaned.length > 0) return cleaned
          if (selectedProvider.type === 'openai') return 'https://api.openai.com/v1'
          return '' // no base => skip
        })()

        if (!base) {
          setLoadingModels(false)
          return
        }

        const url = `${base}/models`
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            ...(selectedProvider.apiKey
              ? { Authorization: `Bearer ${selectedProvider.apiKey}` }
              : {}),
          },
        })
        if (!res.ok) {
          throw new Error(`Failed to fetch models: ${res.status}`)
        }
        const json = await res.json()
        const data: string[] = Array.isArray(json?.data)
          ? json.data
              .map((v: any) => (typeof v?.id === 'string' ? v.id : null))
              .filter((v: string | null): v is string => !!v)
          : []
        setAvailableModels(data)
      } catch (err: any) {
        console.error('Failed to auto fetch models', err)
        setLoadError(err?.message ?? 'unknown error')
      } finally {
        setLoadingModels(false)
      }
    }

    fetchModels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvider?.id])

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

      {/* Auto-fetched models dropdown */}
      <ObsidianSetting
        name={loadingModels ? t('common.loading') : t('settings.models.availableModelsAuto')}
        desc={loadError ? `${t('settings.models.fetchModelsFailed')}：${loadError}` : undefined}
      >
        <ObsidianDropdown
          value={formData.model || ''}
          options={Object.fromEntries(
            availableModels.map((m) => [m, m])
          )}
          onChange={(value: string) => {
            // When a model is selected, fill both ID and model name
            setFormData((prev) => ({ ...prev, id: value, model: value }))
          }}
          disabled={loadingModels || availableModels.length === 0}
        />
      </ObsidianSetting>

      <ObsidianSetting>
        <ObsidianButton text={t('common.add')} onClick={handleSubmit} cta />
        <ObsidianButton text={t('common.cancel')} onClick={onClose} />
      </ObsidianSetting>
    </>
  )
}

