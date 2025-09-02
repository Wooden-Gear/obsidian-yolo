import { ObsidianDropdown } from '../../common/ObsidianDropdown'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { useLanguage } from '../../../contexts/language-context'
import { Language } from '../../../i18n'

const languageOptions: Record<string, string> = {
  en: 'English',
  zh: '中文',
}

export function LanguageSection() {
  const { language, setLanguage, t } = useLanguage()

  return (
    <ObsidianSetting
      name={t('settings.language.title')}
      desc={t('settings.language.select')}
      heading
    >
      <ObsidianDropdown
        options={languageOptions}
        value={language}
        onChange={(value) => setLanguage(value as Language)}
      />
    </ObsidianSetting>
  )
}