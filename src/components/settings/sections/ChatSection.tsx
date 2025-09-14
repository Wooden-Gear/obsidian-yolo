import {
  RECOMMENDED_MODELS_FOR_APPLY,
  RECOMMENDED_MODELS_FOR_CHAT,
} from '../../../constants'
import { useLanguage } from '../../../contexts/language-context'
import { useSettings } from '../../../contexts/settings-context'
import { ObsidianDropdown } from '../../common/ObsidianDropdown'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianTextArea } from '../../common/ObsidianTextArea'
import { DEFAULT_LEARNING_MODE_PROMPT } from '../../../constants'
import { ObsidianTextInput } from '../../common/ObsidianTextInput'
import { ObsidianToggle } from '../../common/ObsidianToggle'

export function ChatSection() {
  const { settings, setSettings } = useSettings()
  const { t } = useLanguage()

  return (
    <div className="smtcmp-settings-section">
      <div className="smtcmp-settings-header">{t('settings.chat.title')}</div>

      <ObsidianSetting
        name={t('settings.chat.defaultModel')}
        desc={t('settings.chat.defaultModelDesc')}
      >
        <ObsidianDropdown
          value={settings.chatModelId}
          options={Object.fromEntries(
            settings.chatModels
              .filter(({ enable }) => enable ?? true)
              .map((chatModel) => {
                const labelBase = chatModel.model || chatModel.name || chatModel.id
                const label = `${labelBase}${RECOMMENDED_MODELS_FOR_CHAT.includes(chatModel.id) ? ' (Recommended)' : ''}`
                return [chatModel.id, label]
              }),
          )}
          onChange={async (value) => {
            await setSettings({
              ...settings,
              chatModelId: value,
            })
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting
        name={t('settings.chat.applyModel')}
        desc={t('settings.chat.applyModelDesc')}
      >
        <ObsidianDropdown
          value={settings.applyModelId}
          options={Object.fromEntries(
            settings.chatModels
              .filter(({ enable }) => enable ?? true)
              .map((chatModel) => {
                const labelBase = chatModel.model || chatModel.name || chatModel.id
                const label = `${labelBase}${RECOMMENDED_MODELS_FOR_APPLY.includes(chatModel.id) ? ' (Recommended)' : ''}`
                return [chatModel.id, label]
              }),
          )}
          onChange={async (value) => {
            await setSettings({
              ...settings,
              applyModelId: value,
            })
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting
        name={t('settings.chat.systemPrompt')}
        desc={t('settings.chat.systemPromptDesc')}
        className="smtcmp-settings-textarea-header"
      />

      <ObsidianSetting className="smtcmp-settings-textarea">
        <ObsidianTextArea
          value={settings.systemPrompt}
          onChange={async (value: string) => {
            await setSettings({
              ...settings,
              systemPrompt: value,
            })
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting
        name={t('settings.chat.includeCurrentFile')}
        desc={t('settings.chat.includeCurrentFileDesc')}
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
        name={t('settings.chat.enableBruteMode')}
        desc={t('settings.chat.enableBruteModeDesc')}
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
        name={t('settings.chat.learningMode')}
        desc={t('settings.chat.learningModeDesc')}
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
            name={t('settings.chat.learningModePrompt')}
            desc={t('settings.chat.learningModePromptDesc')}
            className="smtcmp-settings-textarea-header"
          />
          <ObsidianSetting className="smtcmp-settings-textarea">
            <ObsidianTextArea
              value={
                (settings.chatOptions.learningModePrompt ?? '').trim().length > 0
                  ? settings.chatOptions.learningModePrompt!
                  : DEFAULT_LEARNING_MODE_PROMPT
              }
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
        name={t('settings.chat.enableTools')}
        desc={t('settings.chat.enableToolsDesc')}
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
        name={t('settings.chat.maxAutoIterations')}
        desc={t('settings.chat.maxAutoIterationsDesc')}
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
        name={t('settings.chat.maxContextMessages')}
        desc={t('settings.chat.maxContextMessagesDesc')}
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
        name={t('settings.chat.defaultTemperature')}
        desc={t('settings.chat.defaultTemperatureDesc')}
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
        name={t('settings.chat.defaultTopP')}
        desc={t('settings.chat.defaultTopPDesc')}
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
