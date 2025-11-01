import { en } from './locales/en'
import { zh } from './locales/zh'
import { Language, TranslationKeys } from './types'

const translations: Record<Language, TranslationKeys> = {
  en,
  zh,
}

export function getTranslation(language: Language): TranslationKeys {
  return translations[language] || translations.en
}

export function createTranslationFunction(language: Language) {
  const t = getTranslation(language)

  return function translate(keyPath: string, fallback?: string): string {
    const keys = keyPath.split('.')
    let current: any = t

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key]
      } else {
        return fallback || keyPath
      }
    }

    return typeof current === 'string' ? current : fallback || keyPath
  }
}

export type { Language, TranslationKeys } from './types'
export { en } from './locales/en'
export { zh } from './locales/zh'
