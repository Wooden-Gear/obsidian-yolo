import { App, Notice } from 'obsidian'

import { useLanguage } from '../../../contexts/language-context'
import { useSettings } from '../../../contexts/settings-context'
import SmartComposerPlugin from '../../../main'
import { smartComposerSettingsSchema } from '../../../settings/schema/setting.types'
import { DEFAULT_APPLY_MODEL_ID, DEFAULT_CHAT_MODELS, DEFAULT_CHAT_MODEL_ID, DEFAULT_EMBEDDING_MODELS, DEFAULT_PROVIDERS } from '../../../constants'
import { ChatManager } from '../../../database/json/chat/ChatManager'
import { ObsidianButton } from '../../common/ObsidianButton'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ConfirmModal } from '../../modals/ConfirmModal'

type EtcSectionProps = {
  app: App
  plugin: SmartComposerPlugin
}

export function EtcSection({ app }: EtcSectionProps) {
  const { settings, setSettings } = useSettings()
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

  const handleClearChatHistory = () => {
    new ConfirmModal(app, {
      title: t('settings.etc.clearChatHistory'),
      message: t('settings.etc.clearChatHistoryConfirm'),
      ctaText: t('common.clear'),
      onConfirm: async () => {
        const manager = new ChatManager(app)
        const list = await manager.listChats()
        for (const meta of list) {
          await manager.deleteChat(meta.id)
        }
        // Notify UI hooks (useChatHistory) to refresh chat list immediately
        window.dispatchEvent(new Event('smtcmp:chat-history-cleared'))
        new Notice(t('settings.etc.clearChatHistorySuccess'))
      },
    }).open()
  }

  const handleResetProviders = () => {
    new ConfirmModal(app, {
      title: t('settings.etc.resetProviders'),
      message: t('settings.etc.resetProvidersConfirm'),
      ctaText: t('settings.etc.reset'),
      onConfirm: async () => {
        const defaultChatModelId =
          DEFAULT_CHAT_MODELS.find((v) => v.id === DEFAULT_CHAT_MODEL_ID)?.id ??
          DEFAULT_CHAT_MODELS[0].id
        const defaultApplyModelId =
          DEFAULT_CHAT_MODELS.find((v) => v.id === DEFAULT_APPLY_MODEL_ID)?.id ??
          DEFAULT_CHAT_MODELS[0].id
        const defaultEmbeddingModelId = DEFAULT_EMBEDDING_MODELS[0].id

        await setSettings({
          ...settings,
          providers: [...DEFAULT_PROVIDERS],
          chatModels: [...DEFAULT_CHAT_MODELS],
          embeddingModels: [...DEFAULT_EMBEDDING_MODELS],
          chatModelId: defaultChatModelId,
          applyModelId: defaultApplyModelId,
          embeddingModelId: defaultEmbeddingModelId,
        })
        new Notice(t('settings.etc.resetProvidersSuccess'))
      },
    }).open()
  }

  return (
    <div className="smtcmp-settings-section">
      <div className="smtcmp-settings-header">{t('settings.etc.title')}</div>

      <ObsidianSetting
        name={t('settings.etc.clearChatHistory')}
        desc={t('settings.etc.clearChatHistoryDesc')}
      >
        <ObsidianButton text={t('common.clear')} warning onClick={handleClearChatHistory} />
      </ObsidianSetting>

      <ObsidianSetting
        name={t('settings.etc.resetProviders')}
        desc={t('settings.etc.resetProvidersDesc')}
      >
        <ObsidianButton text={t('settings.etc.reset')} warning onClick={handleResetProviders} />
      </ObsidianSetting>

      <ObsidianSetting
        name={t('settings.etc.resetSettings')}
        desc={t('settings.etc.resetSettingsDesc')}
      >
        <ObsidianButton text={t('settings.etc.reset')} warning onClick={handleResetSettings} />
      </ObsidianSetting>
    </div>
  )
}
