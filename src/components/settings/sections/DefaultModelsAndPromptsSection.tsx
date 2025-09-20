import {
  DEFAULT_CHAT_TITLE_PROMPT,
  DEFAULT_CONTINUATION_SYSTEM_PROMPT,
  RECOMMENDED_MODELS_FOR_APPLY,
  RECOMMENDED_MODELS_FOR_CHAT,
} from '../../../constants'
import { useLanguage } from '../../../contexts/language-context'
import { useSettings } from '../../../contexts/settings-context'
import { ObsidianDropdown } from '../../common/ObsidianDropdown'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianTextArea } from '../../common/ObsidianTextArea'

export function DefaultModelsAndPromptsSection() {
  const { settings, setSettings } = useSettings()
  const { t, language } = useLanguage()

  const continuationPromptValue =
    (settings.continuationOptions.defaultSystemPrompt ?? '').trim().length > 0
      ? settings.continuationOptions.defaultSystemPrompt!
      : DEFAULT_CONTINUATION_SYSTEM_PROMPT

  const defaultTitlePrompt =
    DEFAULT_CHAT_TITLE_PROMPT[language] ?? DEFAULT_CHAT_TITLE_PROMPT.en

  const chatTitlePromptValue =
    (settings.chatOptions.chatTitlePrompt ?? '').trim().length > 0
      ? settings.chatOptions.chatTitlePrompt!
      : defaultTitlePrompt

  const baseModelSpecialPromptValue =
    settings.chatOptions.baseModelSpecialPrompt ?? ''

  return (
    <div className="smtcmp-settings-section">
      <div className="smtcmp-settings-header">{t('settings.defaults.title')}</div>

      <ObsidianSetting
        name={t('settings.defaults.defaultChatModel')}
        desc={t('settings.defaults.defaultChatModelDesc')}
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
        name={t('settings.defaults.toolModel')}
        desc={t('settings.defaults.toolModelDesc')}
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
        name={t('settings.defaults.globalSystemPrompt')}
        desc={t('settings.defaults.globalSystemPromptDesc')}
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

      <ObsidianSetting
        name={t('settings.defaults.chatTitlePrompt')}
        desc={t('settings.defaults.chatTitlePromptDesc')}
        className="smtcmp-settings-textarea-header"
      />

      <ObsidianSetting className="smtcmp-settings-textarea">
        <ObsidianTextArea
          value={chatTitlePromptValue}
          onChange={async (value: string) => {
            await setSettings({
              ...settings,
              chatOptions: {
                ...settings.chatOptions,
                chatTitlePrompt: value,
              },
            })
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting
        name={t('settings.defaults.baseModelSpecialPrompt')}
        desc={t('settings.defaults.baseModelSpecialPromptDesc')}
        className="smtcmp-settings-textarea-header"
      />

      <ObsidianSetting className="smtcmp-settings-textarea">
        <ObsidianTextArea
          value={baseModelSpecialPromptValue}
          onChange={async (value: string) => {
            await setSettings({
              ...settings,
              chatOptions: {
                ...settings.chatOptions,
                baseModelSpecialPrompt: value,
              },
            })
          }}
        />
      </ObsidianSetting>
    </div>
  )
}
