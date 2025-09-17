import { App } from 'obsidian'
import { useMemo } from 'react'

import { useLanguage } from '../../../contexts/language-context'
import { useSettings } from '../../../contexts/settings-context'
import { ObsidianDropdown } from '../../common/ObsidianDropdown'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianToggle } from '../../common/ObsidianToggle'
import { getModelDisplayNameWithProvider } from '../../../utils/model-id-utils'
import { ObsidianTextInput } from '../../common/ObsidianTextInput'

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

  return (
    <div className="smtcmp-settings-section">
      <div className="smtcmp-settings-header">{t('settings.continuation.title')}</div>

      <ObsidianSetting
        name={t('settings.continuation.modelSource')}
        desc={t('settings.continuation.modelSourceDesc')}
      >
        <ObsidianToggle
          value={settings.continuationOptions.useCurrentModel}
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
          disabled={!!settings.continuationOptions.useCurrentModel}
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

      <ObsidianSetting
        name={t('settings.continuation.keywordTrigger')}
        desc={t('settings.continuation.keywordTriggerDesc')}
      >
        <ObsidianToggle
          value={settings.continuationOptions.enableKeywordTrigger}
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

      <ObsidianSetting
        name={t('settings.continuation.floatingPanelKeywordTrigger')}
        desc={t('settings.continuation.floatingPanelKeywordTriggerDesc')}
      >
        <ObsidianToggle
          value={settings.continuationOptions.enableFloatingPanelKeywordTrigger ?? false}
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

    </div>
  )
}
