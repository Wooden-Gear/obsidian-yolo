import { Platform } from 'obsidian'

import { useLanguage } from '../../../contexts/language-context'
import { useSettings } from '../../../contexts/settings-context'
import YoloPlugin from '../../../main'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianToggle } from '../../common/ObsidianToggle'

type PluginUpdateSectionProps = {
  plugin: YoloPlugin
  className?: string
}

export function PluginUpdateSection({
  plugin,
  className,
}: PluginUpdateSectionProps) {
  const { settings, setSettings } = useSettings()
  const { t } = useLanguage()
  const canSelfUpdate = plugin.canSelfUpdatePlugin()

  const handleAutoDownloadChange = (value: boolean) => {
    void (async () => {
      try {
        await setSettings({
          ...settings,
          pluginUpdateAutoDownloadEnabled: value,
        })
      } catch (error: unknown) {
        console.error('Failed to update plugin update settings', error)
      }
    })()
  }

  return (
    <section className={className}>
      <div className="yolo-settings-section-header">
        <h3>{t('settings.pluginUpdate.sectionTitle', 'Plugin updates')}</h3>
      </div>
      <div className="yolo-settings-card-stack">
        <ObsidianSetting
          name={t(
            'settings.pluginUpdate.autoDownload',
            'Auto-download updates',
          )}
          desc={
            Platform.isDesktop && canSelfUpdate
              ? t(
                  'settings.pluginUpdate.autoDownloadDesc',
                  'When a new version is detected, download release files in the background. Installing still requires your confirmation.',
                )
              : t(
                  'settings.pluginUpdate.autoDownloadDescUnavailable',
                  'One-click install is only available on desktop with a local plugin folder. On this device, use the GitHub release page to update manually.',
                )
          }
          className="yolo-settings-card"
        >
          <ObsidianToggle
            value={settings.pluginUpdateAutoDownloadEnabled ?? true}
            onChange={handleAutoDownloadChange}
            disabled={!Platform.isDesktop || !canSelfUpdate}
          />
        </ObsidianSetting>
      </div>
    </section>
  )
}
