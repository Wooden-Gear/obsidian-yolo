import { App, Notice } from 'obsidian'

import { useLanguage } from '../../../contexts/language-context'
import { useSettings } from '../../../contexts/settings-context'
import SmartComposerPlugin from '../../../main'
import { smartComposerSettingsSchema } from '../../../settings/schema/setting.types'
import { ObsidianButton } from '../../common/ObsidianButton'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ConfirmModal } from '../../modals/ConfirmModal'

type EtcSectionProps = {
  app: App
  plugin: SmartComposerPlugin
}

export function EtcSection({ app }: EtcSectionProps) {
  const { setSettings } = useSettings()
  const { t } = useLanguage()

  const handleResetSettings = () => {
    new ConfirmModal(app, {
      title: t('settings.etc.resetSettings'),
      message: t('settings.etc.resetSettingsConfirm'),
      ctaText: t('settings.etc.reset'),
      onConfirm: async () => {
        const defaultSettings = smartComposerSettingsSchema.parse({})
        await setSettings(defaultSettings)
        new Notice(t('settings.etc.resetSettingsSuccess'))
      },
    }).open()
  }

  return (
    <div className="smtcmp-settings-section">
      <div className="smtcmp-settings-header">{t('settings.etc.title')}</div>

      <ObsidianSetting
        name={t('settings.etc.resetSettings')}
        desc={t('settings.etc.resetSettingsDesc')}
      >
        <ObsidianButton text={t('settings.etc.reset')} warning onClick={handleResetSettings} />
      </ObsidianSetting>
    </div>
  )
}
