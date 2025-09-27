import { App } from 'obsidian'
import { useMemo } from 'react'

import { useLanguage } from '../../../contexts/language-context'
import { useSettings } from '../../../contexts/settings-context'
import { ObsidianDropdown } from '../../common/ObsidianDropdown'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianToggle } from '../../common/ObsidianToggle'
import { getModelDisplayNameWithProvider } from '../../../utils/model-id-utils'
import { ObsidianTextInput } from '../../common/ObsidianTextInput'
import { ObsidianTextArea } from '../../common/ObsidianTextArea'
import { DEFAULT_CONTINUATION_SYSTEM_PROMPT } from '../../../constants'
import {
  DEFAULT_TAB_COMPLETION_OPTIONS,
  DEFAULT_TAB_COMPLETION_SYSTEM_PROMPT,
} from '../../../settings/schema/setting.types'

type ContinuationSectionProps = {
  app: App
}

export function ContinuationSection({ app }: ContinuationSectionProps) {
  const { settings, setSettings } = useSettings()
  const { t } = useLanguage()

  const orderedEnabledModels = useMemo(() => {
    const enabledModels = settings.chatModels.filter(({ enable }) => enable ?? true)
    const providerOrder = settings.providers.map((p) => p.id)
    const providerIdsInModels = Array.from(new Set(enabledModels.map((m) => m.providerId)))
    const orderedProviderIds = [
      ...providerOrder.filter((id) => providerIdsInModels.includes(id)),
      ...providerIdsInModels.filter((id) => !providerOrder.includes(id)),
    ]
    return orderedProviderIds.flatMap((pid) =>
      enabledModels.filter((m) => m.providerId === pid),
    )
  }, [settings.chatModels, settings.providers])

  const useCurrentModel = Boolean(settings.continuationOptions.useCurrentModel)
  const enableKeywordTrigger = Boolean(
    settings.continuationOptions.enableKeywordTrigger,
  )
  const enableFloatingPanelKeywordTrigger = Boolean(
    settings.continuationOptions.enableFloatingPanelKeywordTrigger,
  )
  const enableTabCompletion = Boolean(
    settings.continuationOptions.enableTabCompletion,
  )
  const continuationPromptValue =
    (settings.continuationOptions.defaultSystemPrompt ?? '').trim().length > 0
      ? settings.continuationOptions.defaultSystemPrompt!
      : DEFAULT_CONTINUATION_SYSTEM_PROMPT
  const tabCompletionSystemPromptValue =
    (settings.continuationOptions.tabCompletionSystemPrompt ?? '').trim().length > 0
      ? settings.continuationOptions.tabCompletionSystemPrompt!
      : DEFAULT_TAB_COMPLETION_SYSTEM_PROMPT
  const tabCompletionOptions = enableTabCompletion
    ? {
        ...DEFAULT_TAB_COMPLETION_OPTIONS,
        ...(settings.continuationOptions.tabCompletionOptions ?? {}),
      }
    : {
        ...DEFAULT_TAB_COMPLETION_OPTIONS,
        ...(settings.continuationOptions.tabCompletionOptions ?? {}),
      }

  const updateTabCompletionOptions = async (
    updates: Partial<typeof tabCompletionOptions>,
  ) => {
    await setSettings({
      ...settings,
      continuationOptions: {
        ...settings.continuationOptions,
        tabCompletionOptions: {
          ...tabCompletionOptions,
          ...updates,
        },
      },
    })
  }

  const parseNumberOrDefault = (value: string, fallback: number) => {
    if (value.trim().length === 0) return fallback
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  const parseIntegerOption = (value: string, fallback: number) => {
    const parsed = parseNumberOrDefault(value, fallback)
    return Math.round(parsed)
  }

  return (
    <div className="smtcmp-settings-section">
      <div className="smtcmp-settings-header">{t('settings.continuation.title')}</div>
      <div className="smtcmp-settings-sub-header">
        {t('settings.continuation.aiSubsectionTitle')}
      </div>
      <ObsidianSetting
        name={t('settings.continuation.modelSource')}
        desc={t('settings.continuation.modelSourceDesc')}
      >
        <ObsidianToggle
          value={useCurrentModel}
          onChange={async (value) => {
            await setSettings({
              ...settings,
              continuationOptions: {
                ...settings.continuationOptions,
                useCurrentModel: value,
              },
            })
          }}
        />
      </ObsidianSetting>

      {!useCurrentModel && (
        <ObsidianSetting
          name={t('settings.continuation.fixedModel')}
          desc={t('settings.continuation.fixedModelDesc')}
        >
          <ObsidianDropdown
            value={settings.continuationOptions.fixedModelId}
            options={Object.fromEntries(
              orderedEnabledModels.map((m) => [
                m.id,
                getModelDisplayNameWithProvider(
                  m.id,
                  settings.providers.find((p) => p.id === m.providerId)?.id,
                ),
              ]),
            )}
            onChange={async (value) => {
              await setSettings({
                ...settings,
                continuationOptions: {
                  ...settings.continuationOptions,
                  fixedModelId: value,
                },
              })
            }}
          />
        </ObsidianSetting>
      )}

      <ObsidianSetting
        name={t('settings.continuation.keywordTrigger')}
        desc={t('settings.continuation.keywordTriggerDesc')}
      >
        <ObsidianToggle
          value={enableKeywordTrigger}
          onChange={async (value) => {
            await setSettings({
              ...settings,
              continuationOptions: {
                ...settings.continuationOptions,
                enableKeywordTrigger: value,
              },
            })
          }}
        />
      </ObsidianSetting>

      {enableKeywordTrigger && (
        <>
          <ObsidianSetting
            name={t('settings.defaults.continuationSystemPrompt')}
            desc={t('settings.defaults.continuationSystemPromptDesc')}
            className="smtcmp-settings-textarea-header"
          />

          <ObsidianSetting className="smtcmp-settings-textarea">
            <ObsidianTextArea
              value={continuationPromptValue}
              onChange={async (value: string) => {
                await setSettings({
                  ...settings,
                  continuationOptions: {
                    ...settings.continuationOptions,
                    defaultSystemPrompt: value,
                  },
                })
              }}
            />
          </ObsidianSetting>
        </>
      )}

      {enableKeywordTrigger && (
        <ObsidianSetting
          name={t('settings.continuation.triggerKeyword')}
          desc={t('settings.continuation.triggerKeywordDesc')}
        >
          <ObsidianTextInput
            value={settings.continuationOptions.triggerKeyword}
            placeholder={'  '}
            onChange={async (value) => {
              await setSettings({
                ...settings,
                continuationOptions: {
                  ...settings.continuationOptions,
                  triggerKeyword: value,
                },
              })
            }}
          />
        </ObsidianSetting>
      )}

      <div className="smtcmp-settings-sub-header">
        {t('settings.continuation.customSubsectionTitle')}
      </div>
      <ObsidianSetting
        name={t('settings.continuation.floatingPanelKeywordTrigger')}
        desc={t('settings.continuation.floatingPanelKeywordTriggerDesc')}
      >
        <ObsidianToggle
          value={enableFloatingPanelKeywordTrigger}
          onChange={async (value) => {
            await setSettings({
              ...settings,
              continuationOptions: {
                ...settings.continuationOptions,
                enableFloatingPanelKeywordTrigger: value,
              },
            })
          }}
        />
      </ObsidianSetting>

      {enableFloatingPanelKeywordTrigger && (
        <ObsidianSetting
          name={t('settings.continuation.floatingPanelTriggerKeyword')}
          desc={t('settings.continuation.floatingPanelTriggerKeywordDesc')}
        >
          <ObsidianTextInput
            value={settings.continuationOptions.floatingPanelTriggerKeyword ?? ''}
            placeholder={''}
            onChange={async (value) => {
              await setSettings({
                ...settings,
                continuationOptions: {
                  ...settings.continuationOptions,
                  floatingPanelTriggerKeyword: value,
                },
              })
            }}
          />
        </ObsidianSetting>
      )}

      <div className="smtcmp-settings-sub-header">
        {t('settings.continuation.tabSubsectionTitle')}
      </div>
      <ObsidianSetting
        name={t('settings.continuation.tabCompletion')}
        desc={t('settings.continuation.tabCompletionDesc')}
      >
        <ObsidianToggle
          value={enableTabCompletion}
          onChange={async (value) => {
            await setSettings({
              ...settings,
              continuationOptions: {
                ...settings.continuationOptions,
                enableTabCompletion: value,
                tabCompletionOptions: value
                  ? {
                      ...DEFAULT_TAB_COMPLETION_OPTIONS,
                      ...(settings.continuationOptions.tabCompletionOptions ?? {}),
                    }
                  : settings.continuationOptions.tabCompletionOptions,
              },
            })
          }}
        />
      </ObsidianSetting>

      {enableTabCompletion && (
        <>
          <ObsidianSetting
            name={t('settings.defaults.tabCompletionSystemPrompt')}
            desc={t('settings.defaults.tabCompletionSystemPromptDesc')}
            className="smtcmp-settings-textarea-header"
          />

          <ObsidianSetting className="smtcmp-settings-textarea">
            <ObsidianTextArea
              value={tabCompletionSystemPromptValue}
              onChange={async (value: string) => {
                await setSettings({
                  ...settings,
                  continuationOptions: {
                    ...settings.continuationOptions,
                    tabCompletionSystemPrompt: value,
                  },
                })
              }}
            />
          </ObsidianSetting>

          <ObsidianSetting
            name={t('settings.continuation.tabCompletionModel')}
            desc={t('settings.continuation.tabCompletionModelDesc')}
          >
            <ObsidianDropdown
              value={
                settings.continuationOptions.tabCompletionModelId ??
                orderedEnabledModels[0]?.id ??
                ''
              }
              options={Object.fromEntries(
                orderedEnabledModels.map((m) => [
                  m.id,
                  getModelDisplayNameWithProvider(
                    m.id,
                    settings.providers.find((p) => p.id === m.providerId)?.id,
                  ),
                ]),
              )}
              onChange={async (value) => {
                await setSettings({
                  ...settings,
                  continuationOptions: {
                    ...settings.continuationOptions,
                    tabCompletionModelId: value,
                  },
                })
              }}
            />
          </ObsidianSetting>

          <ObsidianSetting
            name={t('settings.continuation.tabCompletionTriggerDelay')}
            desc={t('settings.continuation.tabCompletionTriggerDelayDesc')}
          >
            <ObsidianTextInput
              type="number"
              value={String(tabCompletionOptions.triggerDelayMs)}
              onChange={async (value) => {
                const next = Math.max(
                  0,
                  parseIntegerOption(
                    value,
                    DEFAULT_TAB_COMPLETION_OPTIONS.triggerDelayMs,
                  ),
                )
                await updateTabCompletionOptions({
                  triggerDelayMs: next,
                })
              }}
            />
          </ObsidianSetting>

          <ObsidianSetting
            name={t('settings.continuation.tabCompletionMinContextLength')}
            desc={t('settings.continuation.tabCompletionMinContextLengthDesc')}
          >
            <ObsidianTextInput
              type="number"
              value={String(tabCompletionOptions.minContextLength)}
              onChange={async (value) => {
                const next = Math.max(
                  0,
                  parseIntegerOption(
                    value,
                    DEFAULT_TAB_COMPLETION_OPTIONS.minContextLength,
                  ),
                )
                await updateTabCompletionOptions({
                  minContextLength: next,
                })
              }}
            />
          </ObsidianSetting>

          <ObsidianSetting
            name={t('settings.continuation.tabCompletionMaxContextChars')}
            desc={t('settings.continuation.tabCompletionMaxContextCharsDesc')}
          >
            <ObsidianTextInput
              type="number"
              value={String(tabCompletionOptions.maxContextChars)}
              onChange={async (value) => {
                const next = Math.max(
                  200,
                  parseIntegerOption(
                    value,
                    DEFAULT_TAB_COMPLETION_OPTIONS.maxContextChars,
                  ),
                )
                await updateTabCompletionOptions({
                  maxContextChars: next,
                })
              }}
            />
          </ObsidianSetting>

          <ObsidianSetting
            name={t('settings.continuation.tabCompletionMaxSuggestionLength')}
            desc={t('settings.continuation.tabCompletionMaxSuggestionLengthDesc')}
          >
            <ObsidianTextInput
              type="number"
              value={String(tabCompletionOptions.maxSuggestionLength)}
              onChange={async (value) => {
                const next = Math.max(
                  20,
                  parseIntegerOption(
                    value,
                    DEFAULT_TAB_COMPLETION_OPTIONS.maxSuggestionLength,
                  ),
                )
                await updateTabCompletionOptions({
                  maxSuggestionLength: next,
                })
              }}
            />
          </ObsidianSetting>

          <ObsidianSetting
            name={t('settings.continuation.tabCompletionMaxTokens')}
            desc={t('settings.continuation.tabCompletionMaxTokensDesc')}
          >
            <ObsidianTextInput
              type="number"
              value={String(tabCompletionOptions.maxTokens)}
              onChange={async (value) => {
                const parsed = Math.max(
                  16,
                  Math.min(
                    2000,
                    parseIntegerOption(
                      value,
                      DEFAULT_TAB_COMPLETION_OPTIONS.maxTokens,
                    ),
                  ),
                )
                await updateTabCompletionOptions({
                  maxTokens: parsed,
                })
              }}
            />
          </ObsidianSetting>

          <ObsidianSetting
            name={t('settings.continuation.tabCompletionTemperature')}
            desc={t('settings.continuation.tabCompletionTemperatureDesc')}
          >
            <ObsidianTextInput
              type="number"
              value={String(tabCompletionOptions.temperature)}
              onChange={async (value) => {
                const next = parseNumberOrDefault(
                  value,
                  DEFAULT_TAB_COMPLETION_OPTIONS.temperature,
                )
                await updateTabCompletionOptions({
                  temperature: Math.min(Math.max(next, 0), 2),
                })
              }}
            />
          </ObsidianSetting>

          <ObsidianSetting
            name={t('settings.continuation.tabCompletionRequestTimeout')}
            desc={t('settings.continuation.tabCompletionRequestTimeoutDesc')}
          >
            <ObsidianTextInput
              type="number"
              value={String(tabCompletionOptions.requestTimeoutMs)}
              onChange={async (value) => {
                const next = Math.max(
                  0,
                  parseIntegerOption(
                    value,
                    DEFAULT_TAB_COMPLETION_OPTIONS.requestTimeoutMs,
                  ),
                )
                await updateTabCompletionOptions({
                  requestTimeoutMs: next,
                })
              }}
            />
          </ObsidianSetting>

          <ObsidianSetting
            name={t('settings.continuation.tabCompletionMaxRetries')}
            desc={t('settings.continuation.tabCompletionMaxRetriesDesc')}
          >
            <ObsidianTextInput
              type="number"
              value={String(tabCompletionOptions.maxRetries)}
              onChange={async (value) => {
                const parsed = parseIntegerOption(
                  value,
                  DEFAULT_TAB_COMPLETION_OPTIONS.maxRetries,
                )
                const next = Math.max(0, Math.min(5, parsed))
                await updateTabCompletionOptions({
                  maxRetries: next,
                })
              }}
            />
          </ObsidianSetting>

        </>
      )}

    </div>
  )
}
