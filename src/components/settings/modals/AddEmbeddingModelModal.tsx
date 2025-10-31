import { GoogleGenAI } from '@google/genai'
import { App, Notice } from 'obsidian'
import { useEffect, useState } from 'react'

import { DEFAULT_PROVIDERS, PROVIDER_TYPES_INFO } from '../../../constants'
import { useLanguage } from '../../../contexts/language-context'
import { getProviderClient } from '../../../core/llm/manager'
import { supportedDimensionsForIndex } from '../../../database/schema'
import SmartComposerPlugin from '../../../main'
import {
  EmbeddingModel,
  embeddingModelSchema,
} from '../../../types/embedding-model.types'
import { LLMProvider } from '../../../types/provider.types'
import {
  generateModelId,
  ensureUniqueModelId,
} from '../../../utils/model-id-utils'
import { ObsidianButton } from '../../common/ObsidianButton'
import { ObsidianDropdown } from '../../common/ObsidianDropdown'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianTextInput } from '../../common/ObsidianTextInput'
import { ReactModal } from '../../common/ReactModal'
import { SearchableDropdown } from '../../common/SearchableDropdown'
import { ConfirmModal } from '../../modals/ConfirmModal'

type AddEmbeddingModelModalComponentProps = {
  plugin: SmartComposerPlugin
  onClose: () => void
  provider?: LLMProvider
}

export class AddEmbeddingModelModal extends ReactModal<AddEmbeddingModelModalComponentProps> {
  constructor(app: App, plugin: SmartComposerPlugin, provider?: LLMProvider) {
    super({
      app: app,
      Component: AddEmbeddingModelModalComponent,
      props: { plugin, provider },
      options: {
        title: 'Add Custom Embedding Model', // Will be translated in component
      },
      plugin: plugin,
    })
  }
}

function AddEmbeddingModelModalComponent({
  plugin,
  onClose,
  provider,
}: AddEmbeddingModelModalComponentProps) {
  const { t } = useLanguage()
  const firstEmbeddingCapable = plugin.settings.providers.find(
    (p) => PROVIDER_TYPES_INFO[p.type].supportEmbedding,
  )
  const selectedProvider: LLMProvider | undefined =
    provider ?? firstEmbeddingCapable ?? plugin.settings.providers[0]
  const initialProviderId = selectedProvider?.id ?? DEFAULT_PROVIDERS[0].id
  const initialProviderType =
    selectedProvider?.type ?? DEFAULT_PROVIDERS[0].type
  const [formData, setFormData] = useState<Omit<EmbeddingModel, 'dimension'>>({
    providerId: initialProviderId,
    providerType: initialProviderType,
    id: '',
    model: '',
    name: undefined,
  })

  // Auto-fetch available models via OpenAI-compatible GET /v1/models
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState<boolean>(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Sort models with embedding-related ones first
  const sortModelsForEmbedding = (models: string[]): string[] => {
    const embeddingKeywords = ['embedding', 'embed', 'text-embedding']
    const embeddingModels: string[] = []
    const otherModels: string[] = []

    models.forEach((model) => {
      const modelLower = model.toLowerCase()
      if (embeddingKeywords.some((keyword) => modelLower.includes(keyword))) {
        embeddingModels.push(model)
      } else {
        otherModels.push(model)
      }
    })

    return [...embeddingModels.sort(), ...otherModels.sort()]
  }

  useEffect(() => {
    const fetchModels = async () => {
      if (!selectedProvider) return
      
      // Check cache first
      const cachedModels = plugin.getCachedModelList(selectedProvider.id)
      if (cachedModels) {
        const sorted = sortModelsForEmbedding(cachedModels)
        setAvailableModels(sorted)
        setLoadingModels(false)
        return
      }
      
      setLoadingModels(true)
      setLoadError(null)
      try {
        const isOpenAIStyle =
          selectedProvider.type === 'openai' ||
          selectedProvider.type === 'openai-compatible' ||
          selectedProvider.type === 'openrouter' ||
          selectedProvider.type === 'groq' ||
          selectedProvider.type === 'mistral' ||
          selectedProvider.type === 'perplexity' ||
          selectedProvider.type === 'deepseek'

        if (isOpenAIStyle) {
          const base = ((): string => {
            // default OpenAI base when not provided
            const cleaned = selectedProvider.baseUrl?.replace(/\/+$/, '')
            if (cleaned && cleaned.length > 0) return cleaned
            if (selectedProvider.type === 'openai')
              return 'https://api.openai.com/v1'
            if (selectedProvider.type === 'openrouter')
              return 'https://openrouter.ai/api/v1'
            return '' // no base => skip
          })()

          if (base) {
            const baseNorm = base.replace(/\/+$/, '')
            const urlCandidates: string[] = []
            if (baseNorm.endsWith('/v1')) {
              // Try with v1 first, then without v1
              urlCandidates.push(`${baseNorm}/models`)
              urlCandidates.push(`${baseNorm.replace(/\/v1$/, '')}/models`)
            } else {
              // Try without v1 first, then with v1
              urlCandidates.push(`${baseNorm}/models`)
              urlCandidates.push(`${baseNorm}/v1/models`)
            }

            let fetched = false
            let lastErr: any = null
            for (const url of urlCandidates) {
              try {
                const res = await fetch(url, {
                  method: 'GET',
                  headers: {
                    ...(selectedProvider.apiKey
                      ? { Authorization: `Bearer ${selectedProvider.apiKey}` }
                      : {}),
                    Accept: 'application/json',
                  },
                })
                if (!res.ok) {
                  lastErr = new Error(`Failed to fetch models: ${res.status}`)
                  continue
                }
                const json = await res.json()
                // Robust extraction: support data[], models[], or array root; prefer id, fallback to name/model
                const collectFrom = (arr: any[]): string[] =>
                  arr
                    .map((v: any) =>
                      typeof v === 'string'
                        ? v
                        : (v?.id as string) ||
                          (v?.name as string) ||
                          (v?.model as string) ||
                          null,
                    )
                    .filter((v: string | null): v is string => !!v)

                const buckets: string[] = []
                if (Array.isArray(json?.data))
                  buckets.push(...collectFrom(json.data))
                if (Array.isArray(json?.models))
                  buckets.push(...collectFrom(json.models))
                if (Array.isArray(json)) buckets.push(...collectFrom(json))

                if (buckets.length === 0) {
                  lastErr = new Error('Empty models list in response')
                  continue
                }
                const unique = Array.from(new Set(buckets))
                const sorted = sortModelsForEmbedding(unique)
                setAvailableModels(sorted)
                // Cache the result (unsorted for consistency)
                plugin.setCachedModelList(selectedProvider.id, unique)
                fetched = true
                break
              } catch (e) {
                lastErr = e
                continue
              }
            }
            if (fetched) return
            throw (
              lastErr ?? new Error('Failed to fetch models from all endpoints')
            )
          }
        }

        if (selectedProvider.type === 'gemini') {
          const ai = new GoogleGenAI({ apiKey: selectedProvider.apiKey ?? '' })
          const pager = await ai.models.list()
          const names: string[] = []
          for await (const m of pager as any) {
            const raw = (m?.name || m?.model || '') as string
            if (!raw) continue
            // Normalize like "models/text-embedding-004" -> "text-embedding-004"
            const norm = raw.includes('/') ? raw.split('/').pop()! : raw
            // Keep embedding models and general gemini models
            if (
              norm.toLowerCase().includes('embedding') ||
              norm.toLowerCase().includes('gemini')
            ) {
              names.push(norm)
            }
          }
          // Sort with embedding models first
          const unique = Array.from(new Set(names))
          const sorted = sortModelsForEmbedding(unique)
          setAvailableModels(sorted)
          // Cache the result (unsorted for consistency)
          plugin.setCachedModelList(selectedProvider.id, unique)
          return
        }
      } catch (err: any) {
        console.error('Failed to auto fetch embedding models', err)
        setLoadError(err?.message ?? 'unknown error')
      } finally {
        setLoadingModels(false)
      }
    }

    fetchModels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvider?.id])

  const handleSubmit = async () => {
    try {
      // Generate internal id (provider/model) and ensure uniqueness by suffix if needed
      const baseInternalId = generateModelId(formData.providerId, formData.model)
      const existingIds = plugin.settings.embeddingModels.map((m) => m.id)
      const modelIdWithPrefix = ensureUniqueModelId(existingIds, baseInternalId)

      if (
        !plugin.settings.providers.some(
          (provider) => provider.id === formData.providerId,
        )
      ) {
        throw new Error('Provider with this ID does not exist')
      }

      const providerClient = getProviderClient({
        settings: plugin.settings,
        providerId: formData.providerId,
      })

      const embeddingResult = await providerClient.getEmbedding(
        formData.model,
        'test',
      )

      if (!Array.isArray(embeddingResult) || embeddingResult.length === 0) {
        throw new Error('Embedding model returned an invalid result')
      }

      const dimension = embeddingResult.length

      if (!supportedDimensionsForIndex.includes(dimension)) {
        const confirmed = await new Promise<boolean>((resolve) => {
          new ConfirmModal(plugin.app, {
            title: 'Performance Warning',
            message: `This model outputs ${dimension} dimensions, but the optimized dimensions for database indexing are: ${supportedDimensionsForIndex.join(
              ', ',
            )}.\n\nThis may result in slower search performance.\n\nDo you want to continue anyway?`,
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false),
          }).open()
        })

        if (!confirmed) {
          return
        }
      }

      const embeddingModel: EmbeddingModel = {
        ...formData,
        id: modelIdWithPrefix,
        name:
          formData.name && formData.name.trim().length > 0
            ? formData.name
            : formData.model,
        dimension,
      }

      const validationResult = embeddingModelSchema.safeParse(embeddingModel)

      if (!validationResult.success) {
        throw new Error(
          validationResult.error.issues.map((v) => v.message).join('\n'),
        )
      }

      await plugin.setSettings({
        ...plugin.settings,
        embeddingModels: [...plugin.settings.embeddingModels, embeddingModel],
      })

      onClose()
    } catch (error) {
      new Notice(
        error instanceof Error ? error.message : 'An unknown error occurred',
      )
    }
  }

  return (
    <>
      {/* Available models dropdown (moved above other fields) */}
      <ObsidianSetting
        name={
          loadingModels
            ? t('common.loading')
            : t('settings.models.availableModelsAuto')
        }
        desc={
          loadError
            ? `${t('settings.models.fetchModelsFailed')}：${loadError}`
            : t('settings.models.embeddingModelsFirst')
        }
      >
        <SearchableDropdown
          value={formData.model || ''}
          options={availableModels}
          onChange={(value: string) => {
            // When a model is selected, set API model id and also update display name
            setFormData((prev) => ({
              ...prev,
              model: value,
              name: value, // Always update display name with the selected model
            }))
          }}
          disabled={loadingModels || availableModels.length === 0}
          loading={loadingModels}
          placeholder={t('settings.models.searchModels') || 'Search models...'}
        />
      </ObsidianSetting>

      {/* Display name (moved right below modelId) */}
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

      <ObsidianSetting>
        <ObsidianButton text={t('common.add')} onClick={handleSubmit} cta />
        <ObsidianButton text={t('common.cancel')} onClick={onClose} />
      </ObsidianSetting>
    </>
  )
}
