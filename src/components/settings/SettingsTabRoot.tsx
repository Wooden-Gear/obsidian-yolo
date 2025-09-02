import { App } from 'obsidian'

import SmartComposerPlugin from '../../main'
import { LanguageProvider, useLanguage } from '../../contexts/language-context'
import { ObsidianButton } from '../common/ObsidianButton'
import { ObsidianSetting } from '../common/ObsidianSetting'

import { AssistantsSection } from './sections/AssistantsSection'
import { ChatSection } from './sections/ChatSection'
import { EtcSection } from './sections/EtcSection'
import { LanguageSection } from './sections/LanguageSection'
import { McpSection } from './sections/McpSection'
import { ModelsSection } from './sections/ModelsSection'
import { ProvidersSection } from './sections/ProvidersSection'
import { RAGSection } from './sections/RAGSection'
import { TemplateSection } from './sections/TemplateSection'

type SettingsTabRootProps = {
  app: App
  plugin: SmartComposerPlugin
}

function SettingsContent({ app, plugin }: SettingsTabRootProps) {
  const { t } = useLanguage()

  return (
    <>
      <LanguageSection />
      <ObsidianSetting
        name={t('settings.supportSmartComposer.name')}
        desc={t('settings.supportSmartComposer.desc')}
        heading
        className="smtcmp-settings-support-smart-composer"
      >
        <ObsidianButton
          text={t('settings.supportSmartComposer.buyMeACoffee')}
          onClick={() =>
            window.open('https://www.buymeacoffee.com/kevin.on', '_blank')
          }
          cta
        />
      </ObsidianSetting>
      <ChatSection />
      <AssistantsSection app={app} />
      <ProvidersSection app={app} plugin={plugin} />
      <ModelsSection app={app} plugin={plugin} />
      <RAGSection app={app} plugin={plugin} />
      <McpSection app={app} plugin={plugin} />
      <TemplateSection app={app} />
      <EtcSection app={app} plugin={plugin} />
    </>
  )
}

export function SettingsTabRoot({ app, plugin }: SettingsTabRootProps) {
  return (
    <LanguageProvider>
      <SettingsContent app={app} plugin={plugin} />
    </LanguageProvider>
  )
}
