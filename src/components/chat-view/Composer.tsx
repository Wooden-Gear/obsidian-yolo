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

const Composer: React.FC<ComposerProps> = (_props) => {
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
  const continuationModelId =
    settings.continuationOptions.continuationModelId ??
    orderedEnabledModels[0]?.id ??
    settings.chatModelId
  const enableSuperContinuation = Boolean(
    settings.continuationOptions.enableSuperContinuation,
  )

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
      <div className="smtcmp-composer-scroll">
        <section className="smtcmp-composer-section">
          <header className="smtcmp-composer-heading">
            <div className="smtcmp-composer-heading-title">
              {t('sidebar.composer.sections.model.title', '模型选择')}
            </div>
            <div className="smtcmp-composer-heading-desc">
              {t(
                'sidebar.composer.sections.model.desc',
                '确定续写时优先使用的模型',
              )}
            </div>
          </header>
          <div className="smtcmp-composer-model-select">
            <ObsidianDropdown
              value={continuationModelId}
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
                updateContinuationOptions({ continuationModelId: value })
              }
              disabled={!enableSuperContinuation}
            />
          </div>
        </section>

        <section className="smtcmp-composer-section">
          <header className="smtcmp-composer-heading">
            <div className="smtcmp-composer-heading-title">
              {t('sidebar.composer.sections.parameters.title', '参数设置')}
            </div>
            <div className="smtcmp-composer-heading-desc">
              {t(
                'sidebar.composer.sections.parameters.desc',
                '按需调整续写行为相关的系统参数',
              )}
            </div>
          </header>
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
        </section>

        <section className="smtcmp-composer-section">
          <header className="smtcmp-composer-heading">
            <div className="smtcmp-composer-heading-title">
              {t('sidebar.composer.sections.context.title', '上下文管理')}
            </div>
            <div className="smtcmp-composer-heading-desc">
              {t(
                'sidebar.composer.sections.context.desc',
                '配置续写时优先引用的内容来源',
              )}
            </div>
          </header>
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
