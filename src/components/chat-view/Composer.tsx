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
              {t('sidebar.composer.sections.model.desc', '选择续写时使用的模型')}
            </div>
          </header>
          <div className="smtcmp-composer-option smtcmp-composer-option--model">
            <div className="smtcmp-composer-option-info">
              <div className="smtcmp-composer-option-desc">
                {t(
                  'sidebar.composer.continuationModelDescShort',
                  '不同模型会影响续写质量与速度，可按需切换。',
                )}
              </div>
            </div>
            <div className="smtcmp-composer-option-control">
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
                '针对续写行为的核心开关',
              )}
            </div>
          </header>
          <div className="smtcmp-composer-option">
            <div className="smtcmp-composer-option-info">
              <div className="smtcmp-composer-option-title">
                {t('sidebar.composer.ragToggle', '启用 RAG 检索')}
              </div>
              <div className="smtcmp-composer-option-desc">
                {t(
                  'sidebar.composer.ragToggleDescShort',
                  '在续写前自动召回与当前内容相似的笔记片段。',
                )}
              </div>
            </div>
            <div className="smtcmp-composer-option-control">
              <ObsidianToggle
                value={Boolean(settings.ragOptions.enabled)}
                onChange={(value) => updateRagEnabled(value)}
              />
            </div>
          </div>
        </section>

        <section className="smtcmp-composer-section">
          <header className="smtcmp-composer-heading">
            <div className="smtcmp-composer-heading-title">
              {t('sidebar.composer.sections.context.title', '上下文管理')}
            </div>
            <div className="smtcmp-composer-heading-desc">
              {t(
                'sidebar.composer.sections.context.desc',
                '定义续写时优先参考的内容来源',
              )}
            </div>
          </header>
          <div className="smtcmp-composer-option">
            <div className="smtcmp-composer-option-info">
              <div className="smtcmp-composer-option-title">
                {t('sidebar.composer.manualContextToggle', '手动选择上下文')}
              </div>
              <div className="smtcmp-composer-option-desc">
                {t(
                  'sidebar.composer.manualContextDescShort',
                  '固定一组文件或文件夹，续写时优先参考。',
                )}
              </div>
            </div>
            <div className="smtcmp-composer-option-control">
              <ObsidianToggle
                value={manualContextEnabled}
                onChange={(value) =>
                  updateContinuationOptions({ manualContextEnabled: value })
                }
              />
            </div>
          </div>

          {manualContextEnabled ? (
            <div className="smtcmp-composer-context-picker">
              <FolderSelectionList
                app={app}
                vault={app.vault}
                value={manualContextFolders}
                onChange={(folders) =>
                  updateContinuationOptions({ manualContextFolders: folders })
                }
                title={t(
                  'sidebar.composer.manualContextFoldersTitle',
                  '优先参考目录',
                )}
                placeholder={t(
                  'sidebar.composer.manualContextFoldersPlaceholder',
                  '点击选择优先参考的文件夹（留空表示全库）。',
                )}
              />
            </div>
          ) : (
            <div className="smtcmp-composer-hint">
              {t(
                'sidebar.composer.manualContextHint',
                '开启后即可指定需要优先参考的目录。',
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default Composer
