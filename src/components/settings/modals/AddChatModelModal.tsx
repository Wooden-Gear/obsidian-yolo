import { GoogleGenAI } from '@google/genai'
import { App, Notice } from 'obsidian'
import { useEffect, useState } from 'react'

import { DEFAULT_PROVIDERS } from '../../../constants'
import { useLanguage } from '../../../contexts/language-context'
import SmartComposerPlugin from '../../../main'
import { ChatModel, chatModelSchema } from '../../../types/chat-model.types'
import { LLMProvider } from '../../../types/provider.types'
import {
  detectReasoningTypeFromModelId,
  ensureUniqueModelId,
  generateModelId,
} from '../../../utils/model-id-utils'
import { ObsidianButton } from '../../common/ObsidianButton'
import { ObsidianDropdown } from '../../common/ObsidianDropdown'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianTextInput } from '../../common/ObsidianTextInput'
import { ReactModal } from '../../common/ReactModal'
import { SearchableDropdown } from '../../common/SearchableDropdown'

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
  const selectedProvider: LLMProvider | undefined =
    provider ?? plugin.settings.providers[0]
  const initialProviderId = selectedProvider?.id ?? DEFAULT_PROVIDERS[0].id
  const initialProviderType =
    selectedProvider?.type ?? DEFAULT_PROVIDERS[0].type
  const [formData, setFormData] = useState<ChatModel>({
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
  // Reasoning type selection: none | openai | gemini
  const [reasoningType, setReasoningType] = useState<
    'none' | 'openai' | 'gemini' | 'base'
  >(() => 'none')
  // When user manually changes reasoning type, stop auto-detection
  const [autoDetectReasoning, setAutoDetectReasoning] = useState<boolean>(true)
  const [openaiEffort, setOpenaiEffort] = useState<
    'minimal' | 'low' | 'medium' | 'high'
  >('medium')
  const [geminiBudget, setGeminiBudget] = useState<string>('-1')
  // Tool type (only meaningful for Gemini provider)
  const [toolType, setToolType] = useState<'none' | 'gemini'>('none')
  const [customParameters, setCustomParameters] = useState<
    { key: string; value: string }[]
  >([])

  useEffect(() => {
    const fetchModels = async () => {
      if (!selectedProvider) return
      
      // Check cache first
      const cachedModels = plugin.getCachedModelList(selectedProvider.id)
      if (cachedModels) {
        setAvailableModels(cachedModels)
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
                const unique = Array.from(new Set(buckets)).sort()
                setAvailableModels(unique)
                // Cache the result
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
            // Normalize like "models/gemini-2.5-pro" -> "gemini-2.5-pro"
            const norm = raw.includes('/') ? raw.split('/').pop()! : raw
            // Only keep gemini text/chat models
            if (norm.toLowerCase().includes('gemini')) names.push(norm)
          }
          // De-dup and sort for UX
          const unique = Array.from(new Set(names)).sort()
          setAvailableModels(unique)
          // Cache the result
          plugin.setCachedModelList(selectedProvider.id, unique)
          return
        }
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
    // Validate required API model id
    if (!formData.model || formData.model.trim().length === 0) {
      new Notice(t('common.error'))
      return
    }

    // Generate internal id (provider/model) and ensure uniqueness by suffix if needed
    const baseInternalId = generateModelId(formData.providerId, formData.model)
    const existingIds = plugin.settings.chatModels.map((m) => m.id)
    const modelIdWithPrefix = ensureUniqueModelId(existingIds, baseInternalId)
    // Compose reasoning/thinking fields based on selection ONLY (provider-agnostic)
    const reasoningPatch: Partial<ChatModel> = {}
    if (reasoningType === 'base') {
      ;(reasoningPatch as any).isBaseModel = true
    } else if (reasoningType === 'openai') {
      ;(reasoningPatch as any).reasoning = {
        enabled: true,
        reasoning_effort: openaiEffort,
      }
    } else if (reasoningType === 'gemini') {
      const budget = parseInt(geminiBudget, 10)
      if (Number.isNaN(budget)) {
        new Notice(t('common.error'))
        return
      }
      ;(reasoningPatch as any).thinking = {
        enabled: true,
        thinking_budget: budget,
      }
    }

    if (reasoningType !== 'base') {
      delete (reasoningPatch as any).isBaseModel
    }

    const sanitizedCustomParameters = customParameters
      .map((entry) => ({ key: entry.key.trim(), value: entry.value }))
      .filter((entry) => entry.key.length > 0)

    const modelDataWithPrefix: ChatModel = {
      ...formData,
      ...(reasoningPatch as any),
      id: modelIdWithPrefix,
      name:
        formData.name && formData.name.trim().length > 0
          ? formData.name
          : formData.model,
      // Persist tool type when provider is Gemini; keep optional otherwise
      ...(selectedProvider?.type === 'gemini' ? { toolType } : {}),
      ...(sanitizedCustomParameters.length > 0
        ? { customParameters: sanitizedCustomParameters }
        : {}),
    }

    // Allow duplicates of the same calling ID by uniquifying internal id; no blocking here

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
      {/* Available models dropdown (moved above modelId) */}
      <ObsidianSetting
        name={
          loadingModels
            ? t('common.loading')
            : t('settings.models.availableModelsAuto')
        }
        desc={
          loadError
            ? `${t('settings.models.fetchModelsFailed')}：${loadError}`
            : undefined
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
            if (autoDetectReasoning) {
              const detected = detectReasoningTypeFromModelId(value)
              setReasoningType(detected)
            }
          }}
          disabled={loadingModels || availableModels.length === 0}
          loading={loadingModels}
          placeholder={t('settings.models.searchModels') || 'Search models...'}
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
          onChange={(value: string) => {
            setFormData((prev) => ({ ...prev, model: value }))
            if (autoDetectReasoning) {
              const detected = detectReasoningTypeFromModelId(value)
              setReasoningType(detected)
            }
          }}
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

      {/* Reasoning type */}
      <ObsidianSetting name={t('settings.models.reasoningType')}>
        <ObsidianDropdown
          value={reasoningType}
          options={{
            none: t('settings.models.reasoningTypeNone'),
            openai: t('settings.models.reasoningTypeOpenAI'),
            gemini: t('settings.models.reasoningTypeGemini'),
            base: t('settings.models.reasoningTypeBase'),
          }}
          onChange={(v: string) => {
            setReasoningType(v as any)
            setAutoDetectReasoning(false)
          }}
        />
      </ObsidianSetting>

      {reasoningType === 'base' && (
        <div className="smtcmp-settings-desc">
          {t('settings.models.baseModelWarning')}
        </div>
      )}

      {/* OpenAI reasoning options */}
      {reasoningType === 'openai' && (
        <ObsidianSetting
          name={t('settings.models.openaiReasoningEffort')}
          desc={t('settings.models.openaiReasoningEffortDesc')}
        >
          <ObsidianDropdown
            value={openaiEffort}
            options={{
              minimal: 'minimal',
              low: 'low',
              medium: 'medium',
              high: 'high',
            }}
            onChange={(v: string) => setOpenaiEffort(v as any)}
          />
        </ObsidianSetting>
      )}

      {/* Gemini thinking options */}
      {reasoningType === 'gemini' && (
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

      {/* Tool type for Gemini provider */}
      {selectedProvider?.type === 'gemini' && (
        <ObsidianSetting
          name={t('settings.models.toolType')}
          desc={t('settings.models.toolTypeDesc')}
        >
          <ObsidianDropdown
            value={toolType}
            options={{
              none: t('settings.models.toolTypeNone'),
              gemini: t('settings.models.toolTypeGemini'),
            }}
            onChange={(v: string) => setToolType(v as any)}
          />
        </ObsidianSetting>
      )}

      {/* Provider is derived from the current group context; field removed intentionally */}

      <ObsidianSetting
        name={t('settings.models.customParameters')}
        desc={t('settings.models.customParametersDesc')}
      >
        <ObsidianButton
          text={t('settings.models.customParametersAdd')}
          onClick={() =>
            setCustomParameters((prev) => [...prev, { key: '', value: '' }])
          }
        />
      </ObsidianSetting>

      {customParameters.map((param, index) => (
        <ObsidianSetting
          key={`custom-parameter-${index}`}
          className="smtcmp-settings-kv-entry"
        >
          <ObsidianTextInput
            value={param.key}
            placeholder={t('settings.models.customParametersKeyPlaceholder')}
            onChange={(value: string) =>
              setCustomParameters((prev) => {
                const next = [...prev]
                next[index] = { ...next[index], key: value }
                return next
              })
            }
          />
          <ObsidianTextInput
            value={param.value}
            placeholder={t('settings.models.customParametersValuePlaceholder')}
            onChange={(value: string) =>
              setCustomParameters((prev) => {
                const next = [...prev]
                next[index] = { ...next[index], value }
                return next
              })
            }
          />
          <ObsidianButton
            text={t('common.remove')}
            onClick={() =>
              setCustomParameters((prev) =>
                prev.filter((_, removeIndex) => removeIndex !== index),
              )
            }
          />
        </ObsidianSetting>
      ))}

      <ObsidianSetting>
        <ObsidianButton text={t('common.add')} onClick={handleSubmit} cta />
        <ObsidianButton text={t('common.cancel')} onClick={onClose} />
      </ObsidianSetting>
    </>
  )
}
