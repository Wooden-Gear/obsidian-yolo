import { DEFAULT_LEARNING_MODE_PROMPT } from '../../../constants'
import { useLanguage } from '../../../contexts/language-context'
import { useSettings } from '../../../contexts/settings-context'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianTextArea } from '../../common/ObsidianTextArea'
import { ObsidianTextInput } from '../../common/ObsidianTextInput'
import { ObsidianToggle } from '../../common/ObsidianToggle'

export function ChatPreferencesSection() {
  const { settings, setSettings } = useSettings()
  const { t } = useLanguage()

  const learningModePromptValue =
    (settings.chatOptions.learningModePrompt ?? '').trim().length > 0
      ? settings.chatOptions.learningModePrompt!
      : DEFAULT_LEARNING_MODE_PROMPT

  return (
    <div className="smtcmp-settings-section">
      <div className="smtcmp-settings-header">{t('settings.chatPreferences.title')}</div>

      <ObsidianSetting
        name={t('settings.chatPreferences.includeCurrentFile')}
        desc={t('settings.chatPreferences.includeCurrentFileDesc')}
      >
        <ObsidianToggle
          value={settings.chatOptions.includeCurrentFileContent}
          onChange={async (value) => {
            await setSettings({
              ...settings,
              chatOptions: {
                ...settings.chatOptions,
                includeCurrentFileContent: value,
              },
            })
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting
        name={t('settings.chatPreferences.enableBruteMode')}
        desc={t('settings.chatPreferences.enableBruteModeDesc')}
      >
        <ObsidianToggle
          value={settings.chatOptions.enableBruteMode ?? false}
          onChange={async (value) => {
            await setSettings({
              ...settings,
              chatOptions: {
                ...settings.chatOptions,
                enableBruteMode: value,
              },
            })
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting
        name={t('settings.chatPreferences.enableLearningMode')}
        desc={t('settings.chatPreferences.enableLearningModeDesc')}
      >
        <ObsidianToggle
          value={settings.chatOptions.enableLearningMode ?? false}
          onChange={async (value) => {
            await setSettings({
              ...settings,
              chatOptions: {
                ...settings.chatOptions,
                enableLearningMode: value,
              },
            })
          }}
        />
      </ObsidianSetting>

      {settings.chatOptions.enableLearningMode && (
        <>
          <ObsidianSetting
            name={t('settings.chatPreferences.learningModePrompt')}
            desc={t('settings.chatPreferences.learningModePromptDesc')}
            className="smtcmp-settings-textarea-header"
          />
          <ObsidianSetting className="smtcmp-settings-textarea">
            <ObsidianTextArea
              value={learningModePromptValue}
              onChange={async (value: string) => {
                await setSettings({
                  ...settings,
                  chatOptions: {
                    ...settings.chatOptions,
                    learningModePrompt: value,
                  },
                })
              }}
            />
          </ObsidianSetting>
        </>
      )}

      <ObsidianSetting
        name={t('settings.chatPreferences.enableTools')}
        desc={t('settings.chatPreferences.enableToolsDesc')}
      >
        <ObsidianToggle
          value={settings.chatOptions.enableTools}
          onChange={async (value) => {
            await setSettings({
              ...settings,
              chatOptions: {
                ...settings.chatOptions,
                enableTools: value,
              },
            })
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting
        name={t('settings.chatPreferences.maxAutoIterations')}
        desc={t('settings.chatPreferences.maxAutoIterationsDesc')}
      >
        <ObsidianTextInput
          value={settings.chatOptions.maxAutoIterations.toString()}
          onChange={async (value) => {
            const parsedValue = parseInt(value)
            if (isNaN(parsedValue) || parsedValue < 1) {
              return
            }
            await setSettings({
              ...settings,
              chatOptions: {
                ...settings.chatOptions,
                maxAutoIterations: parsedValue,
              },
            })
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting
        name={t('settings.chatPreferences.maxContextMessages')}
        desc={t('settings.chatPreferences.maxContextMessagesDesc')}
      >
        <ObsidianTextInput
          value={(settings.chatOptions.maxContextMessages ?? 32).toString()}
          onChange={async (value) => {
            const parsedValue = parseInt(value)
            if (isNaN(parsedValue) || parsedValue < 0) {
              return
            }
            await setSettings({
              ...settings,
              chatOptions: {
                ...settings.chatOptions,
                maxContextMessages: parsedValue,
              },
            })
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
          onChange={async (value) => {
            if (value.trim() === '') {
              await setSettings({
                ...settings,
                chatOptions: {
                  ...settings.chatOptions,
                  defaultTemperature: undefined,
                },
              })
              return
            }
            const parsedValue = parseFloat(value)
            if (isNaN(parsedValue) || parsedValue < 0 || parsedValue > 2) {
              return
            }
            await setSettings({
              ...settings,
              chatOptions: {
                ...settings.chatOptions,
                defaultTemperature: parsedValue,
              },
            })
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
          onChange={async (value) => {
            if (value.trim() === '') {
              await setSettings({
                ...settings,
                chatOptions: {
                  ...settings.chatOptions,
                  defaultTopP: undefined,
                },
              })
              return
            }
            const parsedValue = parseFloat(value)
            if (isNaN(parsedValue) || parsedValue < 0 || parsedValue > 1) {
              return
            }
            await setSettings({
              ...settings,
              chatOptions: {
                ...settings.chatOptions,
                defaultTopP: parsedValue,
              },
            })
          }}
        />
      </ObsidianSetting>
    </div>
  )
}
