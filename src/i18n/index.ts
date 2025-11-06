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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getNestedValue(
  source: TranslationKeys,
  path: string[],
): unknown | undefined {
  return path.reduce<unknown | undefined>((current, key) => {
    if (isRecord(current) && key in current) {
      return current[key]
    }
    return undefined
  }, source)
}

export function createTranslationFunction(language: Language) {
  const t = getTranslation(language)

  return function translate(keyPath: string, fallback?: string): string {
    const keys = keyPath.split('.')
    const value = getNestedValue(t, keys)

    return typeof value === 'string' ? value : fallback || keyPath
  }
}

export type { Language, TranslationKeys } from './types'
export { en } from './locales/en'
export { zh } from './locales/zh'
