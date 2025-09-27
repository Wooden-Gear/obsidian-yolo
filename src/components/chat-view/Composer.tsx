import React, { useCallback, useMemo } from 'react'

import { useApp } from '../../contexts/app-context'
import { useLanguage } from '../../contexts/language-context'
import { useSettings } from '../../contexts/settings-context'
import type { SmartComposerSettings } from '../../settings/schema/setting.types'
import { getModelDisplayNameWithProvider } from '../../utils/model-id-utils'
import { ObsidianDropdown } from '../common/ObsidianDropdown'
import { ObsidianSetting } from '../common/ObsidianSetting'
import { ObsidianToggle } from '../common/ObsidianToggle'
import { FolderSelectionList } from '../settings/inputs/FolderSelectionList'

type ComposerProps = {
  onNavigateChat?: () => void
}

const Composer: React.FC<ComposerProps> = ({ onNavigateChat }) => {
  const app = useApp()
  const { t } = useLanguage()
  const { settings, setSettings } = useSettings()

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

  const manualContextEnabled = Boolean(
    settings.continuationOptions.manualContextEnabled,
  )
  const manualContextFolders =
    settings.continuationOptions.manualContextFolders ?? []

  const updateContinuationOptions = useCallback(
    (
      updates: Partial<SmartComposerSettings['continuationOptions']>,
    ) => {
      void setSettings({
        ...settings,
        continuationOptions: {
          ...settings.continuationOptions,
          ...updates,
        },
      })
    },
    [setSettings, settings],
  )

  const updateRagEnabled = useCallback(
    (enabled: boolean) => {
      void setSettings({
        ...settings,
        ragOptions: {
          ...settings.ragOptions,
          enabled,
        },
      })
    },
    [setSettings, settings],
  )

  return (
    <div className="smtcmp-composer-container">
      <div className="smtcmp-composer-header">
        <div>
          <div className="smtcmp-composer-title">
            {t('sidebar.composer.title', 'Composer 模式')}
          </div>
          <div className="smtcmp-composer-subtitle">
            {t('sidebar.composer.subtitle', '在续写前配置模型、上下文与规则')}
          </div>
        </div>
        {onNavigateChat ? (
          <button
            type="button"
            className="smtcmp-composer-back"
            onClick={() => onNavigateChat?.()}
          >
            {t('sidebar.composer.backToChat', '返回聊天')}
          </button>
        ) : null}
      </div>

      <div className="smtcmp-composer-scroll">
        <section className="smtcmp-composer-section">
          <div className="smtcmp-composer-section-title">
            {t('sidebar.composer.modelSectionTitle', '模型设置')}
          </div>
          <ObsidianSetting
            name={t('sidebar.composer.useCurrentModel', '沿用当前聊天模型')}
            desc={t(
              'sidebar.composer.useCurrentModelDesc',
              '续写时直接沿用 Chat 页当前选中的模型与参数',
            )}
          >
            <ObsidianToggle
              value={Boolean(settings.continuationOptions.useCurrentModel)}
              onChange={(value) =>
                updateContinuationOptions({ useCurrentModel: value })
              }
            />
          </ObsidianSetting>

          {!settings.continuationOptions.useCurrentModel && (
            <ObsidianSetting
              name={t('sidebar.composer.fixedModel', '固定续写模型')}
              desc={t(
                'sidebar.composer.fixedModelDesc',
                '为续写任务单独指定模型（Chat 页不会被影响）',
              )}
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
                onChange={(value) =>
                  updateContinuationOptions({ fixedModelId: value })
                }
              />
            </ObsidianSetting>
          )}
        </section>

        <section className="smtcmp-composer-section">
          <div className="smtcmp-composer-section-title">
            {t('sidebar.composer.contextSectionTitle', '上下文来源')}
          </div>
          <ObsidianSetting
            name={t('sidebar.composer.ragToggle', '启用 RAG 检索')}
            desc={t(
              'sidebar.composer.ragToggleDesc',
              '根据 embedding 相似度自动召回相关片段',
            )}
          >
            <ObsidianToggle
              value={Boolean(settings.ragOptions.enabled)}
              onChange={(value) => updateRagEnabled(value)}
            />
          </ObsidianSetting>

          <ObsidianSetting
            name={t('sidebar.composer.manualContextToggle', '手动上下文')}
            desc={t(
              'sidebar.composer.manualContextDesc',
              '挑选特定文件夹，续写前优先作为参考上下文',
            )}
          >
            <ObsidianToggle
              value={manualContextEnabled}
              onChange={(value) =>
                updateContinuationOptions({ manualContextEnabled: value })
              }
            />
          </ObsidianSetting>

          {manualContextEnabled ? (
            <FolderSelectionList
              app={app}
              vault={app.vault}
              value={manualContextFolders}
              onChange={(folders) =>
                updateContinuationOptions({ manualContextFolders: folders })
              }
              title={t(
                'sidebar.composer.manualContextFoldersTitle',
                '续写参考目录',
              )}
              placeholder={t(
                'sidebar.composer.manualContextFoldersPlaceholder',
                '点击选择需要优先参考的文件夹（默认为全部）',
              )}
            />
          ) : null}
        </section>
      </div>
    </div>
  )
}

export default Composer
