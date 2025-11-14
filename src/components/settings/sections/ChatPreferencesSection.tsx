import { useLanguage } from '../../../contexts/language-context'
import { useSettings } from '../../../contexts/settings-context'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianTextInput } from '../../common/ObsidianTextInput'
import { ObsidianToggle } from '../../common/ObsidianToggle'

export function ChatPreferencesSection() {
  const { settings, setSettings } = useSettings()
  const { t } = useLanguage()

  const updateChatOptions = (
    patch: Partial<typeof settings.chatOptions>,
    context: string,
  ) => {
    void (async () => {
      try {
        await setSettings({
          ...settings,
          chatOptions: {
            ...settings.chatOptions,
            ...patch,
          },
        })
      } catch (error: unknown) {
        console.error(`Failed to update chat options: ${context}`, error)
      }
    })()
  }

  return (
    <div className="smtcmp-settings-section">
      <div className="smtcmp-settings-header">
        {t('settings.chatPreferences.title')}
      </div>

      <ObsidianSetting
        name={t('settings.chatPreferences.includeCurrentFile')}
        desc={t('settings.chatPreferences.includeCurrentFileDesc')}
      >
        <ObsidianToggle
          value={settings.chatOptions.includeCurrentFileContent}
          onChange={(value) => {
            updateChatOptions(
              {
                includeCurrentFileContent: value,
              },
              'includeCurrentFileContent',
            )
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting
        name={t('settings.chatPreferences.enableTools')}
        desc={t('settings.chatPreferences.enableToolsDesc')}
      >
        <ObsidianToggle
          value={settings.chatOptions.enableTools}
          onChange={(value) => {
            updateChatOptions(
              {
                enableTools: value,
              },
              'enableTools',
            )
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting
        name={t('settings.chatPreferences.maxAutoIterations')}
        desc={t('settings.chatPreferences.maxAutoIterationsDesc')}
      >
        <ObsidianTextInput
          value={settings.chatOptions.maxAutoIterations.toString()}
          onChange={(value) => {
            const parsedValue = parseInt(value)
            if (isNaN(parsedValue) || parsedValue < 1) {
              return
            }
            updateChatOptions(
              {
                maxAutoIterations: parsedValue,
              },
              'maxAutoIterations',
            )
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting
        name={t('settings.chatPreferences.maxContextMessages')}
        desc={t('settings.chatPreferences.maxContextMessagesDesc')}
      >
        <ObsidianTextInput
          value={(settings.chatOptions.maxContextMessages ?? 32).toString()}
          onChange={(value) => {
            const parsedValue = parseInt(value)
            if (isNaN(parsedValue) || parsedValue < 0) {
              return
            }
            updateChatOptions(
              {
                maxContextMessages: parsedValue,
              },
              'maxContextMessages',
            )
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting
        name={t('settings.chatPreferences.defaultTemperature')}
        desc={t('settings.chatPreferences.defaultTemperatureDesc')}
      >
        <ObsidianTextInput
          value={settings.chatOptions.defaultTemperature?.toString() ?? ''}
          placeholder={t('common.default')}
          onChange={(value) => {
            if (value.trim() === '') {
              updateChatOptions(
                {
                  defaultTemperature: undefined,
                },
                'defaultTemperature (reset)',
              )
              return
            }
            const parsedValue = parseFloat(value)
            if (isNaN(parsedValue) || parsedValue < 0 || parsedValue > 2) {
              return
            }
            updateChatOptions(
              {
                defaultTemperature: parsedValue,
              },
              'defaultTemperature',
            )
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting
        name={t('settings.chatPreferences.defaultTopP')}
        desc={t('settings.chatPreferences.defaultTopPDesc')}
      >
        <ObsidianTextInput
          value={settings.chatOptions.defaultTopP?.toString() ?? ''}
          placeholder={t('common.default')}
          onChange={(value) => {
            if (value.trim() === '') {
              updateChatOptions(
                {
                  defaultTopP: undefined,
                },
                'defaultTopP (reset)',
              )
              return
            }
            const parsedValue = parseFloat(value)
            if (isNaN(parsedValue) || parsedValue < 0 || parsedValue > 1) {
              return
            }
            updateChatOptions(
              {
                defaultTopP: parsedValue,
              },
              'defaultTopP',
            )
          }}
        />
      </ObsidianSetting>
    </div>
  )
}
