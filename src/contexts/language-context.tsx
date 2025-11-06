import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'

import { Language, createTranslationFunction } from '../i18n'

import { usePlugin } from './plugin-context'

type LanguageContextType = {
  language: Language
  t: (keyPath: string, fallback?: string) => string
  setLanguage: (language: Language) => void
}

const LanguageContext = createContext<LanguageContextType | null>(null)

type LanguageProviderProps = {
  children: ReactNode
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const plugin = usePlugin()
  const [language, setLanguageState] = useState<Language>(
    (plugin.settings.language as Language) || 'en',
  )

  // Listen for settings changes
  useEffect(() => {
    const unsubscribe = plugin.addSettingsChangeListener((newSettings) => {
      setLanguageState((newSettings.language as Language) || 'en')
    })
    return unsubscribe
  }, [plugin])

  const t = createTranslationFunction(language)

  const setLanguage = (newLanguage: Language) => {
    void plugin
      .setSettings({
        ...plugin.settings,
        language: newLanguage,
      })
      .catch((error) => {
        console.error('Failed to update language preference', error)
      })
  }

  return (
    <LanguageContext.Provider
      value={{
        language,
        t,
        setLanguage,
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
